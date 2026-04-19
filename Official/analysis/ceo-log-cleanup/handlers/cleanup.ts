// CEO Log Cleanup — gateway handler.
// Runs inside the Docker gateway with SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY env vars.
// Uses raw PostgREST DELETE requests to prune per-table retention windows.

interface Params {
  audit_retention_days?: number;
  chat_retention_days?: number;
  task_retention_days?: number;
  usage_retention_days?: number;
  dry_run?: boolean;
}

interface Result {
  ok: boolean;
  output?: string;
  error?: string;
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString();
}

async function countRows(supabaseUrl: string, serviceKey: string, path: string): Promise<number> {
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}&select=id`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Prefer: 'count=exact',
      Range: '0-0',
    },
  });
  const range = res.headers.get('content-range');
  if (!range) return 0;
  const match = range.match(/\/(\d+|\*)$/);
  if (!match || match[1] === '*') return 0;
  return Number(match[1]);
}

async function deleteRows(supabaseUrl: string, serviceKey: string, path: string): Promise<number> {
  // PostgREST returns the deleted rows with Prefer: return=representation.
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method: 'DELETE',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Prefer: 'return=representation',
    },
  });
  if (!res.ok) return 0;
  const rows = await res.json() as unknown[];
  return Array.isArray(rows) ? rows.length : 0;
}

export default async function run(params: Params): Promise<Result> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return { ok: false, error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in gateway env' };
  }

  const auditDays = params.audit_retention_days ?? 30;
  const chatDays = params.chat_retention_days ?? 90;
  const taskDays = params.task_retention_days ?? 60;
  const usageDays = params.usage_retention_days ?? 180;
  const dryRun = params.dry_run ?? false;

  // For chat_messages we need the list of archived conversation IDs first
  // (PostgREST doesn't support SQL subqueries in in.() filters).
  let archivedConvoFilter = '';
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/conversations?status=eq.archived&select=id`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
    );
    if (res.ok) {
      const convos = await res.json() as Array<{ id: string }>;
      if (convos.length > 0) {
        // PostgREST expects: in.(id1,id2,id3)
        const ids = convos.map(c => c.id).join(',');
        archivedConvoFilter = `&conversation_id=in.(${ids})`;
      } else {
        // No archived convos — skip chat_messages entirely by using an
        // impossible filter.
        archivedConvoFilter = `&conversation_id=eq.__none__`;
      }
    }
  } catch { /* best-effort; will skip chat cleanup if fetch fails */ }

  const targets = [
    // audit_log — only severity=info (keep warnings/errors forever)
    {
      label: 'audit_log (info only)',
      path: `audit_log?severity=eq.info&created_at=lt.${daysAgo(auditDays)}`,
      days: auditDays,
    },
    // task_executions — only successful completed runs
    {
      label: 'task_executions (success only)',
      path: `task_executions?status=eq.success&completed_at=lt.${daysAgo(taskDays)}`,
      days: taskDays,
    },
    // llm_usage — individual per-call rows
    {
      label: 'llm_usage',
      path: `llm_usage?created_at=lt.${daysAgo(usageDays)}`,
      days: usageDays,
    },
    // chat_messages — from archived conversations only. If no archived
    // convos exist, archivedConvoFilter short-circuits to match nothing.
    ...(archivedConvoFilter
      ? [{
          label: 'chat_messages (archived convos)',
          path: `chat_messages?created_at=lt.${daysAgo(chatDays)}${archivedConvoFilter}`,
          days: chatDays,
        }]
      : []),
  ];

  const lines: string[] = [];
  lines.push(`# CEO Log Cleanup ${dryRun ? '(dry run)' : ''}`);
  lines.push('');
  let total = 0;

  for (const t of targets) {
    try {
      const count = await countRows(supabaseUrl, serviceKey, t.path);
      if (dryRun) {
        lines.push(`- **${t.label}** — would delete **${count}** rows older than ${t.days} days`);
      } else {
        const deleted = count === 0 ? 0 : await deleteRows(supabaseUrl, serviceKey, t.path);
        total += deleted;
        lines.push(`- **${t.label}** — deleted **${deleted}** rows older than ${t.days} days`);
      }
    } catch (err) {
      lines.push(`- **${t.label}** — ERROR: ${(err as Error).message}`);
    }
  }

  if (!dryRun) {
    lines.push('');
    lines.push(`**Total rows deleted: ${total}**`);
  }

  return { ok: true, output: lines.join('\n') };
}
