export default async function(params: Record<string, unknown>): Promise<{ result: string }> {
  const tokenBundle = params._apiKey as string;
  if (!tokenBundle) return { result: 'Error: No OAuth token — connect Google Calendar in the Vault first' };

  let accessToken: string;
  try {
    const tokens = JSON.parse(tokenBundle);
    accessToken = tokens.access_token;
  } catch {
    accessToken = tokenBundle;
  }

  const timeMin = (params.time_min as string) || new Date().toISOString();
  const timeMax = params.time_max as string;
  const maxResults = (params.max_results as number) || 10;
  const query = params.query as string;

  const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
  url.searchParams.set('maxResults', String(maxResults));
  url.searchParams.set('timeMin', timeMin);
  if (timeMax) url.searchParams.set('timeMax', timeMax);
  if (query) url.searchParams.set('q', query);
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');

  const resp = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!resp.ok) {
    const err = await resp.text().catch(() => '');
    return { result: `Calendar API error ${resp.status}: ${err}` };
  }

  const data = await resp.json();
  const calendarName = data.summary ?? 'Primary';
  const events = data.items ?? [];

  const lines = [`## Google Calendar — ${calendarName}\n`];

  if (events.length === 0) {
    lines.push('No upcoming events found.');
  } else {
    for (const event of events) {
      const start = event.start?.dateTime ?? event.start?.date ?? 'TBD';
      const end = event.end?.dateTime ?? event.end?.date ?? '';
      const summary = event.summary ?? '(No title)';
      const location = event.location ? ` | ${event.location}` : '';
      lines.push(`- **${summary}** — ${start}${end ? ' → ' + end : ''}${location}`);
    }
  }

  return { result: lines.join('\n') };
}
