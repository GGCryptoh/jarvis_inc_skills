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

  const eventId = params.event_id as string;
  if (!eventId) return { result: 'Error: "event_id" parameter required' };

  const resp = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!resp.ok) {
    const err = await resp.text().catch(() => '');
    return { result: `Calendar API error ${resp.status}: ${err}` };
  }

  return { result: `Event ${eventId} deleted successfully.` };
}
