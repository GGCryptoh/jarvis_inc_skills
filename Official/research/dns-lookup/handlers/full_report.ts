// DNS Full Report Handler
// Queries all common DNS record types for a domain and merges results
export default async function(params: { domain: string }): Promise<{ result: string }> {
  const types = ['A', 'AAAA', 'MX', 'NS', 'TXT', 'SOA'];
  const results: string[] = [];

  for (const type of types) {
    try {
      const resp = await fetch(
        `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(params.domain)}&type=${type}`,
        { headers: { 'Accept': 'application/dns-json' } }
      );
      const data = await resp.json();
      if (data.Answer?.length) {
        const records = data.Answer.map((r: any) => `  ${r.data}`).join('\n');
        results.push(`**${type} Records:**\n${records}`);
      }
    } catch (err: any) {
      results.push(`**${type}:** Error - ${err.message}`);
    }
  }

  return { result: results.join('\n\n') || `No DNS records found for ${params.domain}` };
}
