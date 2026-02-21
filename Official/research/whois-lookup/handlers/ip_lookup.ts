function formatRdapIp(data: Record<string, unknown>): string {
  const lines: string[] = [];

  const handle = (data.handle as string) || 'Unknown';
  lines.push(`## IP Network: ${handle}`);
  lines.push('');

  if (data.name) {
    lines.push(`**Name:** ${data.name}`);
  }
  if (data.startAddress) {
    lines.push(`**Start:** ${data.startAddress}`);
  }
  if (data.endAddress) {
    lines.push(`**End:** ${data.endAddress}`);
  }

  // CIDR
  if (Array.isArray(data.cidr0_cidrs) && data.cidr0_cidrs.length > 0) {
    const cidrs = (data.cidr0_cidrs as Array<{ v4prefix?: string; v6prefix?: string; length: number }>)
      .map((c) => {
        const prefix = c.v4prefix || c.v6prefix || '';
        return `${prefix}/${c.length}`;
      })
      .join(', ');
    lines.push(`**CIDR:** ${cidrs}`);
  }

  if (data.country) {
    lines.push(`**Country:** ${data.country}`);
  }
  if (data.type) {
    lines.push(`**Type:** ${data.type}`);
  }

  // Status
  if (Array.isArray(data.status) && data.status.length > 0) {
    lines.push(`**Status:** ${(data.status as string[]).join(', ')}`);
  }

  // Events
  if (Array.isArray(data.events)) {
    for (const evt of data.events as Array<{ eventAction: string; eventDate: string }>) {
      const action = evt.eventAction;
      const date = evt.eventDate ? evt.eventDate.split('T')[0] : 'unknown';
      if (action === 'registration') {
        lines.push(`**Registration:** ${date}`);
      } else if (action === 'last changed') {
        lines.push(`**Last Changed:** ${date}`);
      }
    }
  }

  // Entities
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
  const ip = params.ip as string;
  if (!ip) return { result: 'Error: ip parameter required' };

  const resp = await fetch(`https://rdap.org/ip/${encodeURIComponent(ip)}`, {
    headers: { Accept: 'application/rdap+json' },
  });

  if (!resp.ok) {
    if (resp.status === 404) return { result: `IP "${ip}" not found in RDAP` };
    return { result: `RDAP returned ${resp.status}` };
  }

  const data = await resp.json();
  return { result: formatRdapIp(data) };
}
