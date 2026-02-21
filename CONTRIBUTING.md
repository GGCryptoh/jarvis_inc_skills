# Contributing to Jarvis Inc Skills

Build, validate, and test skills locally — no Jarvis Inc stack required.

---

## Quick Start

```bash
# 1. Fork and clone
git clone https://github.com/YOUR-USERNAME/jarvis_inc_skills.git
cd jarvis_inc_skills

# 2. Install dev tooling
npm install

# 3. Scaffold a new skill
node scripts/scaffold.mjs my-skill --runtime typescript --connection api_key --category research

# 4. Edit skill.json and handler files
# 5. Validate
node scripts/validate.mjs Official/research/my-skill/

# 6. Test the handler
node scripts/test-handler.mjs my-skill query --params '{"input":"test"}' --api-key sk-xxx

# 7. Update manifest
node scripts/update-manifest.mjs

# 8. Commit and open PR
```

---

## Skill Package Structure

Every skill is a directory under `Official/{category}/{skill-id}/`:

```
my-skill/
|-- skill.json               # Required: metadata + commands
+-- handlers/                # Optional: handler scripts
    |-- query.ts             # One handler per command
    +-- analyze.py
```

### skill.json Required Fields

| Field | Example | Rules |
|-------|---------|-------|
| `id` | `"my-skill"` | kebab-case, must match directory name |
| `title` | `"My Skill"` | 1-60 chars |
| `description` | `"Does something useful"` | 10-500 chars |
| `version` | `"0.1.0"` | semver |
| `author` | `"Your Name"` | non-empty |
| `category` | `"research"` | `communication`, `research`, `creation`, `analysis` |
| `icon` | `"Globe"` | valid [Lucide](https://lucide.dev/icons/) icon name |
| `connection_type` | `"api_key"` | `llm`, `oauth`, `api_key`, `cli`, `channel`, `none` |
| `commands` | `[...]` | at least one command |

### When to Set handler_runtime and files

If **any** command has a `handler_file`, you must also set:
- `handler_runtime`: `"typescript"`, `"python"`, or `"bash"`
- `files`: array of all handler file paths (e.g. `["handlers/query.ts"]`)

---

## Handler I/O Contract

Handlers are standalone scripts. They have **zero imports** from the Jarvis Inc app.

### TypeScript (.ts)

```typescript
export default async function(params: Record<string, unknown>): Promise<{ result: string }> {
  const apiKey = params._apiKey as string;   // injected from Vault
  const input = params.my_param as string;   // your declared params
  // ... call API ...
  return { result: '**Output:** formatted markdown' };
}
```

| | Details |
|---|---|
| **Export** | Single `default async function` |
| **Input** | `params` object — all declared parameters + `_apiKey` (if api_key connection) |
| **Output** | `{ result: string }` — Markdown text shown in chat and collateral |
| **HTTP** | Use global `fetch` (Node 18+) |
| **Errors** | Return `{ result: "Error: description" }` |
| **Timeout** | 30 seconds |

### Python (.py)

```python
import json, sys

def main():
    params = json.loads(sys.stdin.read())
    api_key = params.get("_apiKey", "")
    # ... call API ...
    json.dump({"result": "**Output:** formatted markdown"}, sys.stdout)

if __name__ == "__main__":
    main()
```

| | Details |
|---|---|
| **Input** | JSON on `stdin` — same shape as TypeScript params |
| **Output** | JSON on `stdout` — `{"result": "..."}` or `{"error": "..."}` |
| **Deps** | stdlib only (no pip) — `urllib`, `json`, `base64`, `sys` |
| **Timeout** | 30 seconds |

### Bash (.sh)

```bash
#!/usr/bin/env bash
# Params: PARAM_QUERY, PARAM_LIMIT, etc.
# API key: API_KEY
RESULT=$(curl -s "https://api.example.com/?q=$PARAM_QUERY")
echo "{\"result\": \"$RESULT\"}"
```

| | Details |
|---|---|
| **Input** | Env vars: `PARAM_<NAME>` (uppercased), `API_KEY` |
| **Output** | stdout — JSON preferred, plain text falls back to `{ result: stdout }` |
| **Timeout** | 30 seconds |

---

## Connection Types

| Type | `_apiKey` injected? | Use case |
|------|-------------------|----------|
| `api_key` | Yes (from Vault) | External APIs requiring auth (OpenAI, Stability, etc.) |
| `oauth` | No (uses OAuth tokens) | Google APIs, Slack — requires `oauth_config` |
| `llm` | No | Generative tasks — uses `system_prompt` + `prompt_template`, no handlers |
| `cli` | No | CLI tools in Docker sandbox |
| `channel` | Yes (from notification_channels) | Messaging bots (Telegram, Slack) — set `channel_type` |
| `none` | No | Free APIs, no auth needed (Cloudflare DoH, wttr.in) |

---

## Execution Models

Skills use one of four models. The runtime tries them in this order:

### 1. Declarative HTTP (`request` + `response`)
For simple REST calls. No code needed.

```json
{
  "name": "query",
  "request": { "method": "GET", "path": "", "query": { "name": "{domain}" } },
  "response": { "extract": { "records": "Answer[*]" } },
  "output_template": "**Records:** {records}"
}
```

### 2. Handler File (`handler_file`)
For API calls needing auth, binary data, or multi-step logic. Recommended for most skills.

```json
{
  "handler_runtime": "typescript",
  "files": ["handlers/query.ts"],
  "commands": [{ "name": "query", "handler_file": "handlers/query.ts", ... }]
}
```

### 3. CLI Command Template (`cli_command_template`)
For HTTP-as-CLI with URL templates:

```json
{
  "name": "get_forecast",
  "cli_command_template": { "url_template": "https://wttr.in/{location}?format=j1", "method": "GET" }
}
```

### 4. LLM-Powered (`system_prompt` + `prompt_template`)
For generative tasks — no handlers, the LLM does the work:

```json
{
  "connection_type": "llm",
  "models": ["Claude Sonnet 4.5"],
  "commands": [{
    "name": "draft",
    "system_prompt": "You are a writer...",
    "prompt_template": "Write about: {topic}"
  }]
}
```

---

## Full Example: Building a Weather Skill

Let's build a skill that fetches weather data from the free wttr.in API.

### 1. Scaffold

```bash
node scripts/scaffold.mjs weather-lookup --runtime typescript --connection none --category research
```

### 2. Edit skill.json

```json
{
  "id": "weather-lookup",
  "title": "Weather Lookup",
  "description": "Get current weather conditions for any city using the free wttr.in API",
  "version": "0.1.0",
  "author": "Your Name",
  "category": "research",
  "icon": "CloudSun",
  "tags": ["weather", "forecast"],
  "status": "available",
  "connection_type": "none",
  "models": null,
  "default_model": null,
  "fixed_service": "wttr.in",
  "service_type": "fixed",
  "oauth_config": null,
  "curl_example": "curl 'https://wttr.in/London?format=j1'",
  "cli_config": null,
  "api_config": { "base_url": "https://wttr.in", "vault_service": "none" },
  "execution_handler": null,
  "output_type": "text",
  "collateral": false,
  "risk_level": "safe",
  "handler_runtime": "typescript",
  "files": ["handlers/current.ts"],
  "commands": [
    {
      "name": "current",
      "description": "Get current weather for a city",
      "handler_file": "handlers/current.ts",
      "parameters": [
        { "name": "city", "type": "string", "required": true, "description": "City name" }
      ],
      "returns": { "type": "text", "description": "Current weather conditions" }
    }
  ]
}
```

### 3. Write the handler

```typescript
// handlers/current.ts
export default async function(params: Record<string, unknown>): Promise<{ result: string }> {
  const city = params.city as string;
  const resp = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
  if (!resp.ok) return { result: `Error: HTTP ${resp.status}` };

  const data = await resp.json() as any;
  const cur = data.current_condition?.[0];
  if (!cur) return { result: 'No weather data available' };

  return {
    result: [
      `## Weather in ${city}`,
      `- **Temperature:** ${cur.temp_F}F / ${cur.temp_C}C`,
      `- **Feels like:** ${cur.FeelsLikeF}F / ${cur.FeelsLikeC}C`,
      `- **Condition:** ${cur.weatherDesc?.[0]?.value ?? 'Unknown'}`,
      `- **Humidity:** ${cur.humidity}%`,
      `- **Wind:** ${cur.windspeedMiles} mph ${cur.winddir16Point}`,
    ].join('\n'),
  };
}
```

### 4. Validate

```bash
$ node scripts/validate.mjs Official/research/weather-lookup/

weather-lookup (Official/research/weather-lookup)
  PASS  Valid (v0.1.0, 1 commands)
```

### 5. Test

```bash
$ node scripts/test-handler.mjs weather-lookup current --params '{"city":"London"}'

weather-lookup -> current
Handler:  handlers/current.ts
Runtime:  typescript
Params:   {"city":"London"}

--- Result ---
{
  "result": "## Weather in London\n- **Temperature:** 55F / 13C\n..."
}

Completed in 342ms
```

### 6. Update manifest and submit PR

```bash
node scripts/update-manifest.mjs
git add Official/research/weather-lookup/ manifest.json
git commit -m "feat: add weather-lookup skill"
```

---

## Validation & Testing Commands

### Validate a single skill

```bash
node scripts/validate.mjs Official/research/my-skill/
```

Checks: JSON Schema compliance, handler files exist, files array matches disk, id matches directory name, unique command names, handler_runtime consistency.

### Validate all skills

```bash
node scripts/validate.mjs
```

### Test a handler

```bash
# With parameters
node scripts/test-handler.mjs my-skill command_name --params '{"key":"value"}'

# With API key
node scripts/test-handler.mjs my-skill command_name --params '{"key":"value"}' --api-key sk-xxx

# Dry run (validates without executing)
node scripts/test-handler.mjs my-skill command_name --dry-run
```

### Update manifest

```bash
node scripts/update-manifest.mjs
```

Regenerates `manifest.json` with SHA-256 checksums for all skills.

### Scaffold a new skill

```bash
# With flags
node scripts/scaffold.mjs my-skill --runtime typescript --connection api_key --category research

# Interactive mode (prompts for missing options)
node scripts/scaffold.mjs my-skill
```

---

## PR Checklist

Before submitting a pull request, ensure:

- [ ] `node scripts/validate.mjs Official/{category}/{your-skill}/` passes with no errors
- [ ] `node scripts/test-handler.mjs {your-skill} {command} --params '{...}'` returns expected results (or `--dry-run` passes for paid APIs)
- [ ] `node scripts/update-manifest.mjs` has been run and `manifest.json` is updated
- [ ] `skill.json` has a meaningful `description` (10-500 chars)
- [ ] Version follows semver: `0.1.0` for initial release
- [ ] Handler files use only stdlib (Python) or global `fetch` (TypeScript) — no external dependencies
- [ ] No secrets, API keys, or credentials in committed files
- [ ] `risk_level` is set appropriately (`safe` for read-only, `moderate` for writes, `dangerous` for shell/system access)
- [ ] `files` array lists every file the gateway needs to install the skill

---

## Templates

Copy a starter template from `templates/` to get going quickly:

| Template | Connection | Runtime | Copy command |
|----------|-----------|---------|-------------|
| `templates/api-key-skill/` | `api_key` | TypeScript | `cp -r templates/api-key-skill Official/{cat}/{id}` |
| `templates/fixed-skill/` | `none` | TypeScript | `cp -r templates/fixed-skill Official/{cat}/{id}` |
| `templates/python-skill/` | `api_key` | Python | `cp -r templates/python-skill Official/{cat}/{id}` |

After copying, update the `id`, `title`, `description`, and other fields in `skill.json`.

---

## License

By contributing, you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE).
