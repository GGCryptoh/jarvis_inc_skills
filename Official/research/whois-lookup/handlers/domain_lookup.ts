function formatRdapDomain(data: Record<string, unknown>): string {
  const lines: string[] = [];

  const name = (data.ldhName as string) || (data.handle as string) || 'Unknown';
  lines.push(`## Domain: ${name}`);
  lines.push('');

  // Status
  if (Array.isArray(data.status) && data.status.length > 0) {
    lines.push(`**Status:** ${data.status.join(', ')}`);
  }

  // Events (registration, expiration, last changed)
  if (Array.isArray(data.events)) {
    for (const evt of data.events as Array<{ eventAction: string; eventDate: string }>) {
      const action = evt.eventAction;
      const date = evt.eventDate ? evt.eventDate.split('T')[0] : 'unknown';
      if (action === 'registration') {
        lines.push(`**Registration:** ${date}`);
      } else if (action === 'expiration') {
        lines.push(`**Expiration:** ${date}`);
      } else if (action === 'last changed') {
        lines.push(`**Last Changed:** ${date}`);
      }
    }
  }

  // Nameservers
  if (Array.isArray(data.nameservers) && data.nameservers.length > 0) {
    lines.push('');
    lines.push('### Nameservers');
    for (const ns of data.nameservers as Array<{ ldhName?: string }>) {
      if (ns.ldhName) {
        lines.push(`- ${ns.ldhName}`);
      }
    }
  }

  // Entities (registrar, registrant, etc.)
  if (Array.isArray(data.entities) && data.entities.length > 0) {
    lines.push('');
    lines.push('### Entities');
    for (const ent of data.entities as Array<Record<string, unknown>>) {
      const roles = Array.isArray(ent.roles) ? (ent.roles as string[]).join(', ') : 'unknown';
      let name = ent.handle as string | undefined;
      try {
        const vcard = ent.vcardArray as [string, Array<[string, Record<string, unknown>, string, string]>];
        if (Array.isArray(vcard) && Array.isArray(vcard[1])) {
          const fn = vcard[1].find((v) => v[0] === 'fn');
          if (fn && fn[3]) {
            name = fn[3];
          }
        }
      } catch {
        // fall back to handle
      }
      lines.push(`- **${roles}:** ${name || 'N/A'}`);
    }
  }

  return lines.join('\n');
}

export default async function (params: Record<string, unknown>): Promise<{ result: string }> {
  const domain = params.domain as string;
  if (!domain) return { result: 'Error: domain parameter required' };

  const resp = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
    headers: { Accept: 'application/rdap+json' },
  });

  if (!resp.ok) {
    if (resp.status === 404) return { result: `Domain "${domain}" not found in RDAP` };
    return { result: `RDAP returned ${resp.status}` };
  }

  const data = await resp.json();
  return { result: formatRdapDomain(data) };
}
