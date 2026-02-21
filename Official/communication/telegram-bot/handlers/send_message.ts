export default async function(params: Record<string, unknown>): Promise<{ result: string }> {
  const botToken = params._apiKey as string;
  if (!botToken) return { result: 'Error: No Telegram bot token — add it in the Vault' };

  const chatId = params.chat_id as string;
  const text = params.text as string;
  if (!chatId || !text) return { result: 'Error: chat_id and text are required' };

  const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });

  const data = await resp.json();
  if (!data.ok) return { result: `Telegram API error: ${data.description ?? 'Unknown error'}` };

  return { result: `Message sent to chat ${chatId} (message_id: ${data.result?.message_id})` };
}
