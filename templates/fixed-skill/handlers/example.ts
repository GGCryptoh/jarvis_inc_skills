/**
 * Example TypeScript handler for a fixed (no auth) skill.
 *
 * I/O Contract:
 *   Input:  params object with command parameters (no _apiKey for "none" connection)
 *   Output: { result: string } — Markdown-formatted result text
 *
 * Since connection_type is "none", no API key is injected.
 * This pattern works for free public APIs (Cloudflare DoH, wttr.in, etc.).
 */
export default async function(params: Record<string, unknown>): Promise<{ result: string }> {
  const query = params.query as string;

  // TODO: Replace with your actual API call
  const resp = await fetch(`https://api.example.com/free-endpoint?q=${encodeURIComponent(query)}`);

  if (!resp.ok) {
    return { result: `Error: HTTP ${resp.status} ${resp.statusText}` };
  }

  const data = await resp.json() as Record<string, unknown>;

  // TODO: Format the response as Markdown
  return { result: `**Result:** ${JSON.stringify(data)}` };
}
