// Fetch Webpage as Markdown Handler
// Uses Cloudflare's Markdown for Agents to convert web pages to clean markdown
export default async function(params: { url: string; _apiKey?: string }): Promise<{ result: string }> {
  const { url } = params;
  if (!url) {
    return { result: 'Error: url parameter is required' };
  }

  const resp = await fetch(url, {
    headers: {
      'Accept': 'text/markdown, text/html;q=0.9, */*;q=0.8',
    },
  });

  if (!resp.ok) {
    return { result: `Error: HTTP ${resp.status} ${resp.statusText} fetching ${url}` };
  }

  const contentType = resp.headers.get('content-type') || '';
  const isMarkdown = contentType.includes('text/markdown');
  const tokenHeader = resp.headers.get('x-markdown-tokens');
  const body = await resp.text();

  if (isMarkdown) {
    const tokenNote = tokenHeader ? ` | ~${tokenHeader} tokens` : '';
    return { result: `<!-- Markdown via Cloudflare${tokenNote} -->\n\n${body}` };
  }

  return { result: `<!-- Raw HTML fallback -->\n\n${body}` };
}
