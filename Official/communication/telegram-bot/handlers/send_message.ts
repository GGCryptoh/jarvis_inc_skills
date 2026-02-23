export default async function(params: Record<string, unknown>): Promise<{ result: string }> {
  const botToken = params._apiKey as string;
  if (!botToken) return { result: 'Error: No Telegram bot token — add it in the Vault' };

  const chatId = params.chat_id as string;
  const text = params.text as string;
  if (!chatId || !text) return { result: 'Error: chat_id and text are required' };

  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: (params.parse_mode as string) ?? 'Markdown',
  };

  // Support inline keyboard buttons (reply_markup as JSON string or object)
  if (params.reply_markup) {
    body.reply_markup = typeof params.reply_markup === 'string'
      ? JSON.parse(params.reply_markup)
      : params.reply_markup;
  }

  const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await resp.json();
  if (!data.ok) return { result: `Telegram API error: ${data.description ?? 'Unknown error'}` };

  return { result: JSON.stringify({ message_id: data.result?.message_id, chat_id: chatId, ok: true }) };
}
