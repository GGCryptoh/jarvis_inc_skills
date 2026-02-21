export default async function(params: Record<string, unknown>): Promise<{ result: string }> {
  const tokenBundle = params._apiKey as string;
  if (!tokenBundle) return { result: 'Error: No OAuth token — connect Gmail in the Vault first' };

  let accessToken: string;
  try {
    const tokens = JSON.parse(tokenBundle);
    accessToken = tokens.access_token;
  } catch {
    // Might be a plain access token
    accessToken = tokenBundle;
  }

  const query = (params.query as string) || '';
  const maxResults = (params.max_results as number) || 10;

  const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
  url.searchParams.set('maxResults', String(maxResults));
  if (query) url.searchParams.set('q', query);

  const resp = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!resp.ok) {
    const err = await resp.text().catch(() => '');
    return { result: `Gmail API error ${resp.status}: ${err}` };
  }

  const data = await resp.json();
  const messages = data.messages ?? [];
  const count = data.resultSizeEstimate ?? messages.length;

  // Format message list
  const lines = [`## Gmail — Recent Messages\n`, `Approximate total: ${count}\n`];
  for (const msg of messages) {
    lines.push(`- **ID:** ${msg.id} (thread: ${msg.threadId})`);
  }
  lines.push('\n> Use the `read` command with a message ID to see full content.');

  return { result: lines.join('\n') };
}
