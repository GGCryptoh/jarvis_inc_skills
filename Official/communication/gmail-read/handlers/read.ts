export default async function(params: Record<string, unknown>): Promise<{ result: string }> {
  const tokenBundle = params._apiKey as string;
  if (!tokenBundle) return { result: 'Error: No OAuth token' };

  let accessToken: string;
  try {
    const tokens = JSON.parse(tokenBundle);
    accessToken = tokens.access_token;
  } catch {
    accessToken = tokenBundle;
  }

  const messageId = params.message_id as string;
  if (!messageId) return { result: 'Error: message_id parameter required' };

  const resp = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!resp.ok) {
    const err = await resp.text().catch(() => '');
    return { result: `Gmail API error ${resp.status}: ${err}` };
  }

  const data = await resp.json();

  // Extract useful headers
  const headers = data.payload?.headers ?? [];
  const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';

  const from = getHeader('From');
  const to = getHeader('To');
  const subject = getHeader('Subject');
  const date = getHeader('Date');

  // Decode body
  let body = data.snippet ?? '';
  const parts = data.payload?.parts ?? [];
  for (const part of parts) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      body = Buffer.from(part.body.data, 'base64url').toString('utf-8');
      break;
    }
  }
  if (!body && data.payload?.body?.data) {
    body = Buffer.from(data.payload.body.data, 'base64url').toString('utf-8');
  }

  const lines = [
    `## Email`,
    '',
    `**From:** ${from}`,
    `**To:** ${to}`,
    `**Subject:** ${subject}`,
    `**Date:** ${date}`,
    `**Labels:** ${(data.labelIds ?? []).join(', ')}`,
    '',
    '---',
    '',
    body,
  ];

  return { result: lines.join('\n') };
}
