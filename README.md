# Jarvis Inc -- Skills Repository

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

The canonical collection of skill packages for the Jarvis Inc God View Dashboard. Each skill is a self-contained directory defining a capability that AI agents can execute -- from sending Telegram messages to generating images with Gemini to looking up DNS records.

---

## Directory Structure

```
skills_repo/
|-- manifest.json                         # Master index: paths, file lists, checksums
|-- schema/
|   +-- skill.schema.json                 # JSON Schema for validating skill.json files
|-- Official/                             # Maintained by Jarvis Inc
|   |-- communication/
|   |   |-- telegram-bot/
|   |   |   |-- skill.json               # Skill definition
|   |   |   +-- handlers/
|   |   |       |-- send_message.ts       # TypeScript handler
|   |   |       +-- get_updates.ts
|   |   |-- gmail-read/
|   |   +-- calendar-read-google/
|   |-- research/
|   |   |-- whois-lookup/
|   |   |   |-- skill.json
|   |   |   +-- handlers/
|   |   |       |-- domain_lookup.ts
|   |   |       +-- ip_lookup.ts
|   |   |-- dns-lookup/
|   |   |-- fetch-webpage-markdown/
|   |   +-- weather-cli/
|   |-- creation/
|   |   |-- create-images-gemini/
|   |   |   |-- skill.json
|   |   |   +-- handlers/
|   |   |       +-- generate.py           # Python handler
|   |   |-- create-images-openai/
|   |   |-- write-document/               # LLM-only (no handlers/)
|   |   +-- generate-code/                # LLM-only (no handlers/)
|   +-- analysis/
|       |-- summarize-document/
|       |-- translate-text/
|       |-- analyze-image/
|       +-- memory-cleanup/
+-- Marketplace/                          # Community-contributed skills
    +-- README.md
```

Skills live at `Official/{category}/{skill-id}/`. Each skill directory contains a `skill.json` and optionally a `handlers/` directory with executable handler files.

---

## Skill Package Anatomy

A skill package is a directory containing:

```
{skill-id}/
|-- skill.json               # Required: skill definition (metadata + commands)
+-- handlers/                # Optional: handler scripts for command execution
    |-- command_name.ts      # One handler per command (TypeScript or Python)
    +-- another_command.py
```

### skill.json

The skill definition file declares metadata, connection details, and commands.

#### Top-Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Unique kebab-case identifier (e.g. `telegram-bot`) |
| `title` | `string` | Yes | Human-readable name (max 60 chars) |
| `description` | `string` | Yes | What the skill does (10-500 chars) |
| `version` | `string` | Yes | Semantic version (e.g. `0.1.0`) |
| `author` | `string` | Yes | Author name or org |
| `category` | `string` | Yes | `communication`, `research`, `creation`, or `analysis` |
| `icon` | `string` | Yes | Lucide React icon name (e.g. `Globe`, `Search`, `Sparkles`) |
| `connection_type` | `string` | Yes | `llm`, `oauth`, `api_key`, `cli`, or `none` |
| `commands` | `array` | Yes | At least one command definition |
| `handler_runtime` | `string` | -- | `typescript`, `python`, `bash`, or `null` |
| `files` | `string[]` | -- | List of handler files to install (e.g. `["handlers/generate.py"]`) |
| `tags` | `string[]` | -- | Kebab-case tags for search/filtering |
| `status` | `string` | -- | `available`, `coming_soon`, `beta`, `deprecated` |
| `models` | `string[]` | -- | LLM model options (required when `connection_type` is `llm`) |
| `default_model` | `string` | -- | Default LLM model selection |
| `api_config` | `object` | -- | API endpoint config (`base_url`, `vault_service`, `auth_in_query`, etc.) |
| `risk_level` | `string` | -- | `safe` (default), `moderate`, or `dangerous` |
| `output_type` | `string` | -- | `text`, `image`, `audio`, `data`, or `mixed` |
| `collateral` | `boolean` | -- | Whether results save to Collateral page (default `true`) |

#### Command Fields

Each command in the `commands` array defines one action the skill can perform.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | snake_case command name (e.g. `send_message`) |
| `description` | `string` | Yes | What this command does |
| `parameters` | `array` | Yes | Typed parameter definitions |
| `returns` | `object` | Yes | Return type + description |
| `handler_file` | `string` | -- | Path to handler script (e.g. `handlers/send_message.ts`) |
| `system_prompt` | `string` | -- | LLM system prompt (for LLM-powered commands) |
| `prompt_template` | `string` | -- | LLM user message template with `{param}` interpolation |
| `request` | `object` | -- | Declarative HTTP request config |
| `response` | `object` | -- | Response extraction config |
| `output_template` | `string` | -- | Markdown template with `{field}` placeholders |
| `cli_command_template` | `object` | -- | CLI/HTTP command template |

---

## Execution Models

Skills use one of four execution models. The runtime tries them in priority order.

### 1. Handler File (recommended for API skills)

The skill specifies `handler_runtime` and `handler_file` per command. The gateway executes the handler script. This is the preferred approach for skills that call external APIs.

**skill.json fields:**
```json
{
  "handler_runtime": "typescript",
  "files": ["handlers/send_message.ts", "handlers/get_updates.ts"],
  "commands": [
    {
      "name": "send_message",
      "handler_file": "handlers/send_message.ts",
      ...
    }
  ]
}
```

### 2. LLM-Powered (for generative tasks)

The skill provides `system_prompt` and `prompt_template` on each command. The runtime sends the interpolated prompt to the user's selected LLM model. No handlers needed.

```json
{
  "connection_type": "llm",
  "models": ["Claude Sonnet 4.5", "GPT-5.2"],
  "default_model": "Claude Sonnet 4.5",
  "commands": [
    {
      "name": "draft",
      "system_prompt": "You are a professional writer...",
      "prompt_template": "Write about: {topic}\nTone: {tone}",
      ...
    }
  ]
}
```

### 3. Declarative HTTP (for simple REST calls)

The skill defines `request`, `response`, and `output_template` on each command. The runtime constructs and sends the HTTP request from the JSON config -- no code needed.

```json
{
  "commands": [
    {
      "name": "query",
      "request": { "method": "GET", "path": "", "query": { "name": "{domain}" } },
      "response": { "extract": { "records": "Answer[*]" } },
      "output_template": "**Records:** {records}",
      ...
    }
  ]
}
```

### 4. CLI Command Template (for HTTP-as-CLI)

A variant of declarative HTTP using `cli_command_template` with `url_template`:

```json
{
  "commands": [
    {
      "name": "get_forecast",
      "cli_command_template": {
        "url_template": "https://wttr.in/{location}?format=j1",
        "method": "GET",
        "response_type": "json"
      },
      "response": { "extract": { "temp": "current_condition[0].temp_F" } },
      "output_template": "Temperature: {temp}F",
      ...
    }
  ]
}
```

---

## Handler Patterns

### TypeScript Handlers

TypeScript handlers export a default async function that receives the command parameters (plus `_apiKey` if the skill uses `api_key` connection) and returns `{ result: string }`.

**Convention:** `handlers/{command_name}.ts`

```typescript
// handlers/send_message.ts
export default async function(params: Record<string, unknown>): Promise<{ result: string }> {
  const botToken = params._apiKey as string;
  if (!botToken) return { result: 'Error: No bot token -- add it in the Vault' };

  const chatId = params.chat_id as string;
  const text = params.text as string;

  const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });

  const data = await resp.json();
  if (!data.ok) return { result: `API error: ${data.description ?? 'Unknown'}` };

  return { result: `Message sent (id: ${data.result?.message_id})` };
}
```

**Key points:**
- Export a single `default async function`
- Signature: `(params: Record<string, unknown>) => Promise<{ result: string }>`
- API keys arrive as `params._apiKey` (injected by the executor from the Vault)
- Return `{ result: "..." }` with a human-readable string (Markdown supported)
- Return `{ result: "Error: ..." }` for error cases
- Use the global `fetch` API for HTTP calls (Node 18+)

### Python Handlers

Python handlers read JSON from stdin and write JSON to stdout.

**Convention:** `handlers/{command_name}.py`

```python
# handlers/generate.py
"""Image generation handler.

Reads JSON from stdin: { "prompt": "...", "_apiKey": "..." }
Writes JSON to stdout: { "result": "markdown", "imageUrl": "data:..." }
"""
import json
import sys
from urllib.request import Request, urlopen

def main():
    params = json.loads(sys.stdin.read())
    prompt = params.get("prompt", "")
    api_key = params.get("_apiKey", "")

    if not api_key:
        json.dump({"error": "No API key"}, sys.stdout)
        return

    # ... call external API ...

    json.dump({
        "result": "## Generated Image\n\n![image](data:image/png;base64,...)",
        "imageUrl": "data:image/png;base64,...",
    }, sys.stdout)

if __name__ == "__main__":
    main()
```

**Key points:**
- Read all input from `sys.stdin` as JSON
- API keys arrive as `params["_apiKey"]`
- Write JSON to `sys.stdout` with `json.dump()`
- Return `{"result": "..."}` for success, `{"error": "..."}` for failure
- For image skills, also include `"imageUrl"` in the output
- Use only Python stdlib (no pip dependencies) -- `urllib`, `json`, `base64`, etc.
- Include `if __name__ == "__main__": main()` guard

### Handler File Naming

Handler files match the command `name` field:

| Command name | Handler file |
|---|---|
| `send_message` | `handlers/send_message.ts` |
| `domain_lookup` | `handlers/domain_lookup.ts` |
| `generate` | `handlers/generate.py` |

The `handler_file` field on each command explicitly links them:
```json
{
  "name": "send_message",
  "handler_file": "handlers/send_message.ts"
}
```

### The `_apiKey` Injection

For skills with `connection_type: "api_key"`, the executor looks up the API key from the Vault using the skill's `api_config.vault_service` field and injects it as `_apiKey` into the handler params. Handlers never need to query the Vault directly.

---

## Categories

| Category | Directory | Description | Examples |
|---|---|---|---|
| **communication** | `Official/communication/` | Messaging, email, calendar | Telegram Bot, Gmail Read, Google Calendar |
| **research** | `Official/research/` | Data lookup, web fetching | WHOIS, DNS, Weather, Fetch Webpage |
| **creation** | `Official/creation/` | Generating content | Gemini Images, OpenAI Images, Write Document |
| **analysis** | `Official/analysis/` | Processing existing content | Summarize, Translate, Analyze Image |

---

## Schema Reference

All `skill.json` files must validate against `schema/skill.schema.json`.

```bash
# Validate with ajv-cli (Node.js)
npx ajv-cli validate -s schema/skill.schema.json -d "Official/**/skill.json"

# Validate with check-jsonschema (Python)
check-jsonschema --schemafile schema/skill.schema.json Official/**/skill.json
```

---

## Adding a New Skill

1. **Create the directory:**
   ```
   Official/{category}/{skill-id}/
   ```

2. **Write `skill.json`** with required fields (`id`, `title`, `description`, `version`, `author`, `category`, `icon`, `connection_type`, `commands`). Set `handler_runtime` and `files` if adding handlers.

3. **Write handler files** (if needed) in `handlers/`. Set `handler_file` on each command that uses one.

4. **Validate** against the schema:
   ```bash
   npx ajv-cli validate -s schema/skill.schema.json -d Official/{category}/{skill-id}/skill.json
   ```

5. **Update `manifest.json`** -- add an entry with the skill path, type `"directory"`, file list, and checksum.

6. **Test** in the dashboard via the Skill Test Dialog (Skills page > click Test on your skill).

### Quick Decision: Which Execution Model?

| Scenario | Use |
|---|---|
| Generative text task (writing, summarizing, translating) | LLM (`system_prompt` + `prompt_template`) |
| Simple REST GET with JSON extraction | Declarative HTTP (`request` + `response` + `output_template`) |
| API call needing auth, binary data, or multi-step logic | Handler file (`handler_runtime` + `handler_file`) |
| CLI tool wrapping an HTTP endpoint | CLI command template (`cli_command_template`) |

---

## Manifest

`manifest.json` indexes all skills for the resolver. Each entry specifies:

```json
{
  "path": "Official/communication/telegram-bot",
  "type": "directory",
  "manifest_file": "skill.json",
  "files": ["skill.json", "handlers/send_message.ts", "handlers/get_updates.ts"],
  "checksum": "347400..."
}
```

The `files` array lists every file the gateway needs to install. Legacy single-file skills use `"type": "file"` with a `.json` path.

---

## Versioning

Skills follow [Semantic Versioning](https://semver.org/):

- **MAJOR** -- Breaking changes to commands or parameters
- **MINOR** -- New commands added, backward-compatible
- **PATCH** -- Bug fixes, description updates, no interface changes

Always increment the version and update `manifest.json` when modifying a skill.

---

## Disclaimer

THIS SOFTWARE AND ALL SKILL DEFINITIONS ARE PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NONINFRINGEMENT.

IN NO EVENT SHALL THE AUTHORS, CONTRIBUTORS, OR JARVIS INC BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT, OR OTHERWISE, ARISING FROM, OUT OF, OR IN CONNECTION WITH THE SOFTWARE, THE SKILL DEFINITIONS, OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

**Important notices:**

- Skills that connect to external APIs may incur usage costs on those platforms. You are responsible for charges incurred by your API keys.
- Community skills in `Marketplace/` are NOT reviewed or endorsed by Jarvis Inc. Review skill definitions before enabling them.
- OAuth scopes and API permissions should be reviewed carefully. Only grant the minimum permissions necessary.

---

## License

Licensed under the [Apache License, Version 2.0](https://www.apache.org/licenses/LICENSE-2.0).

Copyright 2026 Jarvis Inc. See [LICENSE](LICENSE) for the full license text.
