export default async function(params: Record<string, unknown>): Promise<{ result: string }> {
  const botToken = params._apiKey as string;
  if (!botToken) return { result: 'Error: No Telegram bot token — add it in the Vault' };

  const limit = (params.limit as number) || 10;
  const offset = params.offset as number | undefined;
  const allowedUpdates = params.allowed_updates as string[] | undefined;

  const body: Record<string, unknown> = { limit, timeout: 0 };
  if (offset) body.offset = offset;
  if (allowedUpdates) body.allowed_updates = allowedUpdates;

  const resp = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await resp.json();

  if (!data.ok) return { result: `Telegram API error: ${data.description ?? 'Unknown error'}` };

  // Return raw JSON for programmatic consumption (callback polling, etc.)
  return { result: JSON.stringify(data.result ?? []) };
}
