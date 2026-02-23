export default async function(params: Record<string, unknown>): Promise<{ result: string }> {
  const tokenBundle = params._apiKey as string;
  if (!tokenBundle) return { result: 'Error: No OAuth token — connect Gmail Full Access in the Vault first' };

  let accessToken: string;
  try {
    const tokens = JSON.parse(tokenBundle);
    accessToken = tokens.access_token;
  } catch {
    accessToken = tokenBundle;
  }

  const to = params.to as string;
  const subject = params.subject as string;
  const body = params.body as string;
  const cc = params.cc as string;
  const replyTo = params.reply_to as string;

  if (!to) return { result: 'Error: "to" parameter required' };
  if (!subject) return { result: 'Error: "subject" parameter required' };
  if (!body) return { result: 'Error: "body" parameter required' };

  // Build RFC 2822 message
  const headers: string[] = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=UTF-8',
  ];
  if (cc) headers.push(`Cc: ${cc}`);

  const raw = [...headers, '', body].join('\r\n');

  // Base64url encode
  const encoded = btoa(unescape(encodeURIComponent(raw)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const url = replyTo
    ? `https://gmail.googleapis.com/gmail/v1/users/me/messages/send`
    : `https://gmail.googleapis.com/gmail/v1/users/me/messages/send`;

  const payload: Record<string, string> = { raw: encoded };
  if (replyTo) {
    // Get the thread ID for the reply
    const msgResp = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${replyTo}?format=metadata`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (msgResp.ok) {
      const msgData = await msgResp.json();
      payload.threadId = msgData.threadId;
    }
  }

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const err = await resp.text().catch(() => '');
    return { result: `Gmail API error ${resp.status}: ${err}` };
  }

  const data = await resp.json();
  return { result: `Email sent successfully.\n\n**Message ID:** ${data.id}\n**Thread ID:** ${data.threadId}` };
}
