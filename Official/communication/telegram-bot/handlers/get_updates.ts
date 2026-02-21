export default async function(params: Record<string, unknown>): Promise<{ result: string }> {
  const botToken = params._apiKey as string;
  if (!botToken) return { result: 'Error: No Telegram bot token — add it in the Vault' };

  const limit = (params.limit as number) || 10;

  const resp = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates?limit=${limit}&timeout=0`);
  const data = await resp.json();

  if (!data.ok) return { result: `Telegram API error: ${data.description ?? 'Unknown error'}` };

  const updates = data.result ?? [];
  if (updates.length === 0) return { result: 'No recent messages.' };

  const lines = ['## Telegram — Recent Messages\n'];
  for (const update of updates) {
    const msg = update.message;
    if (!msg) continue;
    const from = msg.from?.username ?? msg.from?.first_name ?? 'Unknown';
    const chatId = msg.chat?.id;
    const text = msg.text ?? '(non-text message)';
    const date = new Date((msg.date ?? 0) * 1000).toISOString();
    lines.push(`- **${from}** (chat: ${chatId}) at ${date}:\n  > ${text}`);
  }

  return { result: lines.join('\n') };
}
