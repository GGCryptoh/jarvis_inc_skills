export default async function(params: Record<string, unknown>): Promise<{ result: string }> {
  const tokenBundle = params._apiKey as string;
  if (!tokenBundle) return { result: 'Error: No OAuth token — connect Google Calendar Full Access in the Vault first' };

  let accessToken: string;
  try {
    const tokens = JSON.parse(tokenBundle);
    accessToken = tokens.access_token;
  } catch {
    accessToken = tokenBundle;
  }

  const summary = params.summary as string;
  const start = params.start as string;
  const end = params.end as string;
  const description = params.description as string;
  const location = params.location as string;
  const attendeesRaw = params.attendees as string;

  if (!summary) return { result: 'Error: "summary" parameter required' };
  if (!start) return { result: 'Error: "start" parameter required' };
  if (!end) return { result: 'Error: "end" parameter required' };

  const event: Record<string, unknown> = {
    summary,
    start: { dateTime: start },
    end: { dateTime: end },
  };
  if (description) event.description = description;
  if (location) event.location = location;
  if (attendeesRaw) {
    event.attendees = attendeesRaw.split(',').map(e => ({ email: e.trim() }));
  }

  const resp = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    },
  );

  if (!resp.ok) {
    const err = await resp.text().catch(() => '');
    return { result: `Calendar API error ${resp.status}: ${err}` };
  }

  const data = await resp.json();
  const startStr = data.start?.dateTime ?? data.start?.date ?? 'TBD';

  return {
    result: `Event created successfully.\n\n**Event:** ${data.summary}\n**When:** ${startStr}\n**ID:** ${data.id}\n**Link:** ${data.htmlLink ?? 'N/A'}`,
  };
}
