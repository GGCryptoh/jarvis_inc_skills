/**
 * Example TypeScript handler for an api_key skill.
 *
 * I/O Contract:
 *   Input:  params object with command parameters + `_apiKey` (string)
 *   Output: { result: string } — Markdown-formatted result text
 *
 * The `_apiKey` value is automatically injected by the executor from the Vault
 * based on the skill's `api_config.vault_service` field. Handlers never need
 * to query the Vault directly.
 *
 * Use the global `fetch` API for HTTP calls (Node 18+).
 * Return `{ result: "Error: ..." }` for error cases.
 */
export default async function(params: Record<string, unknown>): Promise<{ result: string }> {
  const apiKey = params._apiKey as string;
  if (!apiKey) {
    return { result: 'Error: No API key — add it in the Vault under "TODO_service_name"' };
  }

  const input = params.input as string;

  // TODO: Replace with your actual API call
  const resp = await fetch(`https://api.example.com/endpoint?q=${encodeURIComponent(input)}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });

  if (!resp.ok) {
    return { result: `Error: HTTP ${resp.status} ${resp.statusText}` };
  }

  const data = await resp.json() as Record<string, unknown>;

  // TODO: Format the response as Markdown
  return { result: `**Result:** ${JSON.stringify(data)}` };
}
