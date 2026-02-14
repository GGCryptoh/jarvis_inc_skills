# Jarvis Inc -- Official Skills Repository

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

The canonical collection of skill definitions for the Jarvis Inc God View Dashboard. Skills are JSON descriptors that define capabilities available to AI agents -- from reading email to generating code to deep multi-source research.

---

## What Are Skills?

A **skill** is a self-contained JSON file that describes a single capability an AI agent can perform. Each skill defines:

- **What it does** (title, description, category)
- **How it connects** (OAuth, API key, LLM, CLI)
- **What commands it exposes** (with typed parameters and return values)
- **Which models can power it** (for LLM-based skills)
- **How to execute** (declarative HTTP config, LLM system prompts, or named handlers)

Skills are declarative -- they describe the interface and execution shape, not imperative code. The Jarvis Inc runtime reads these definitions to present capabilities in the dashboard, handle authentication flows, and route agent tasks to the correct backends.

---

## Repository Structure

```
skills_repo/
|-- manifest.json                         # Master index of all skills with paths and checksums
|-- schema/
|   +-- skill.schema.json                 # JSON Schema for validating skill files
|-- Official/                             # Maintained by Jarvis Inc
|   |-- research/
|   |   |-- research_web.json             # Web search, page analysis, fact-checking (LLM)
|   |   |-- weather_cli.json              # Real-time weather via wttr.in (CLI -> HTTP)
|   |   |-- dns_lookup.json               # DNS record queries via Cloudflare DoH (no key)
|   |   |-- fetch_webpage_markdown.json   # Fetch any URL as clean markdown (no key)
|   |   +-- whois_lookup.json             # WHOIS/RDAP domain + IP lookups (no key)
|   |-- creation/
|   |   |-- create_images_openai.json     # Image generation via DALL-E 3 (API key)
|   |   |-- create_images_gemini.json     # Image generation via Gemini (API key)
|   |   |-- write_document.json           # Draft, rewrite, expand documents (LLM)
|   |   +-- generate_code.json            # Generate, review, debug code (LLM)
|   +-- analysis/
|       |-- summarize_document.json       # Summarize text, extract key points (LLM)
|       |-- translate_text.json           # Translate between languages (LLM)
|       +-- analyze_image.json            # Describe images, extract text (LLM)
+-- Marketplace/                          # Community-contributed skills
    +-- README.md
```

---

## Schema Documentation

Every skill file must conform to `schema/skill.schema.json`. The tables below describe all fields.

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier in kebab-case (e.g. `read-email`) |
| `title` | `string` | Human-readable name shown in the UI (max 60 chars) |
| `description` | `string` | What the skill does (10-500 chars) |
| `version` | `string` | Semantic version (e.g. `1.0.0`) |
| `author` | `string` | Author name or organization |
| `category` | `string` | One of: `communication`, `research`, `creation`, `analysis` |
| `icon` | `string` | Lucide React icon name (e.g. `Mail`, `Globe`, `Code`) |
| `connection_type` | `string` | One of: `llm`, `oauth`, `api_key`, `cli`, `none` |
| `commands` | `array` | At least one command definition (see below) |

### Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `tags` | `string[]` | `[]` | Kebab-case tags for search and filtering |
| `status` | `string` | `available` | One of: `available`, `coming_soon`, `beta`, `deprecated` |
| `models` | `string[] \| null` | `null` | Available LLM models. **Required** when `connection_type` is `llm`. |
| `default_model` | `string \| null` | `null` | Default model selection. **Required** when `connection_type` is `llm`. |
| `fixed_service` | `string \| null` | `null` | Name of the fixed external service (e.g. `Google`, `Slack`) |
| `service_type` | `string \| null` | `null` | `fixed` or `configurable` |
| `oauth_config` | `object \| null` | `null` | OAuth 2.0 config. **Required** when `connection_type` is `oauth`. |
| `curl_example` | `string \| null` | `null` | Example cURL command for API-based skills |
| `cli_config` | `object \| null` | `null` | CLI tool config. **Required** when `connection_type` is `cli`. |
| `api_config` | `object \| null` | `null` | API endpoint config. Used for `api_key` and `none` connection types. See below. |
| `output_type` | `string` | `text` | Primary output type: `text`, `image`, `audio`, `data`, `mixed` |
| `collateral` | `boolean` | `true` | Whether results auto-save to Collateral page as artifacts |
| `execution_handler` | `string \| null` | `null` | Named handler function in `skillExecutor.ts` for direct API execution |
| `risk_level` | `string` | `safe` | Risk classification: `safe`, `moderate` (yellow warning), `dangerous` (type-to-confirm) |
| `pricing` | `object \| null` | `null` | Cost model for API usage. See Pricing section. |

### Connection Types

| Type | Description | Required Config |
|------|-------------|-----------------|
| `llm` | Powered by a language model. User selects which model to use. | `models`, `default_model` |
| `oauth` | Connects via OAuth 2.0 flow (e.g. Google, Slack). | `oauth_config`, `fixed_service` |
| `api_key` | Authenticates with an API key (e.g. OpenAI). | `fixed_service`, `api_config` |
| `cli` | Wraps a local command-line tool. | `cli_config` |
| `none` | No external connection needed (free public APIs). | `api_config` (optional) |

### API Config (for `api_key` and `none` connection types)

When `connection_type` is `api_key` or `none`, the `api_config` object tells the runtime how to authenticate and call the external API.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `base_url` | `string` | *(required)* | Base URL for API requests (e.g. `https://api.openai.com/v1`) |
| `vault_service` | `string` | *(required)* | Vault service name to look up the API key (use `none` for free APIs) |
| `auth_header` | `string` | `Authorization` | Header name for the API key |
| `auth_prefix` | `string` | `Bearer` | Prefix before the key value (empty string for key-in-query APIs) |
| `api_model` | `string` | -- | Model ID used in API calls (e.g. `dall-e-3`, `gemini-2.5-flash-image`) |
| `headers` | `object` | `{}` | Custom HTTP headers for every request |

### Pricing Config

Optional cost tracking for API-based skills.

| Field | Type | Description |
|-------|------|-------------|
| `model` | `string` | `free`, `per_request`, or `per_token` |
| `base_cost_usd` | `number` | Base cost per request in USD |
| `tiers` | `array` | Conditional pricing rules (e.g. different cost by image size) |

---

## Command Definition

Each skill must have at least one command. Commands define the actions agents can perform.

### Required Command Fields

```json
{
  "name": "search",
  "description": "Search the web for information on a topic",
  "parameters": [
    {
      "name": "query",
      "type": "string",
      "required": true,
      "description": "Search query string"
    },
    {
      "name": "max_results",
      "type": "number",
      "required": false,
      "description": "Maximum number of results",
      "default": 10
    }
  ],
  "returns": {
    "type": "array",
    "description": "Array of search result objects with title, url, and snippet"
  }
}
```

**Parameter types**: `string`, `number`, `boolean`, `array`, `object`

**Parameter fields**:
- `name` (required) -- snake_case identifier
- `type` (required) -- data type
- `required` (required) -- whether the parameter must be provided
- `description` (required) -- human-readable explanation
- `default` (optional) -- default value for optional parameters
- `enum` (optional) -- array of allowed values

**Return fields**:
- `type` (required) -- return data type
- `description` (required) -- what the return value contains
- `media_type` (optional) -- MIME type hint for rendering (e.g. `image/png`)

### Optional Command Fields (Execution Config)

These fields control HOW a command is executed. You only need one execution style per command.

#### LLM Execution (`system_prompt` + `prompt_template`)

For skills powered by a language model. The runtime sends the prompt to the user's selected LLM.

| Field | Type | Description |
|-------|------|-------------|
| `system_prompt` | `string` | System prompt for the LLM. Supports `{param}` interpolation from parameters. |
| `prompt_template` | `string` | User message template. Supports `{param}` interpolation from parameters. |

**Example** (from `write_document.json`):
```json
{
  "name": "draft",
  "description": "Draft a new document on a given topic",
  "system_prompt": "You are a professional writer. Write a well-structured {format} document.\nTone: {tone}.\nAudience: {audience}.",
  "prompt_template": "Write a document about: {topic}\n\nAdditional instructions: {instructions}",
  "parameters": [
    { "name": "topic", "type": "string", "required": true, "description": "Document topic" },
    { "name": "format", "type": "string", "required": false, "default": "markdown", "enum": ["markdown", "plain", "html"] },
    { "name": "tone", "type": "string", "required": false, "default": "professional" },
    { "name": "audience", "type": "string", "required": false, "default": "general" },
    { "name": "instructions", "type": "string", "required": false, "default": "" }
  ],
  "returns": { "type": "string", "description": "The drafted document" }
}
```

#### Declarative HTTP (`request` + `response` + `output_template`)

For skills that call a REST API. The runtime builds and sends the HTTP request from JSON config -- no code needed.

| Field | Type | Description |
|-------|------|-------------|
| `request` | `object` | HTTP request config: `method`, `path`, `query`, `headers`, `body`. Supports `{param}` interpolation. |
| `response` | `object` | How to parse the response: `extract` (dot-path fields), `passthrough` (raw), `passthrough_to_llm` (send to LLM for formatting), `error_path`. |
| `output_template` | `string` | Markdown template with `{field}` placeholders from extracted response data. |
| `post_processors` | `array` | Optional post-processing steps (e.g. `upload_image`, `estimate_cost`). |

**Example** (from `dns_lookup.json`):
```json
{
  "name": "query",
  "description": "Query DNS records for a domain",
  "request": {
    "method": "GET",
    "path": "",
    "query": { "name": "{domain}", "type": "{type}" }
  },
  "response": {
    "extract": { "records": "Answer[*]" }
  },
  "output_template": "**{domain} {type} Records:**\n{records}",
  "parameters": [
    { "name": "domain", "type": "string", "required": true, "description": "Domain name to query" },
    { "name": "type", "type": "string", "required": false, "default": "A", "enum": ["A", "AAAA", "MX", "NS", "TXT", "CNAME", "SOA"] }
  ],
  "returns": { "type": "object", "description": "DNS query results" }
}
```

**Dot-path syntax** for `response.extract`:
- `foo.bar` -- nested object access
- `foo[0].bar` -- array index
- `foo[*].bar` -- map over array (returns array of values)
- `foo[?].bar` -- first matching element

#### Named Handler (`execution_handler`)

For skills that need custom code (complex auth, binary data, multi-step flows). Set `execution_handler` at the skill level and the runtime dispatches to a registered TypeScript handler.

---

## Output Types

The `output_type` field determines how skill results are rendered in chat, test dialogs, and the Collateral page.

| Type | Description | Example Skills |
|------|-------------|----------------|
| `text` | Plain text or markdown output | Research Web, Weather CLI, Write Document |
| `image` | Image URLs or base64 data | Image Generate (DALL-E, Gemini) |
| `audio` | Audio files or streams | Text-to-Speech (future) |
| `data` | Structured JSON data | DNS Lookup, WHOIS |
| `mixed` | Multiple output types in one response | Skills that return text + images |

When `collateral` is `true` (the default), execution results are automatically saved to the Collateral page as reviewable artifacts.

---

## Creating Your Own Skills

### Using AI to Generate Skill JSON

Load the following system prompt into your preferred LLM (Claude, GPT-4, etc.) along with this README to generate valid skill JSON:

<details>
<summary><strong>Skill Author System Prompt</strong> (click to expand)</summary>

```
You are a Jarvis Inc Skill Author. You create skill definition JSON files for the Jarvis Inc Skills Repository.

RULES:
1. Output ONLY valid JSON. No markdown fences, no commentary before or after.
2. Every skill MUST have: id, title, description, version, author, category, icon, connection_type, commands.
3. Use kebab-case for id (e.g. "my-cool-skill").
4. Use snake_case for command names and parameter names.
5. version must be semver (e.g. "0.1.0").
6. category must be one of: communication, research, creation, analysis.
7. icon must be a valid Lucide icon name (e.g. Globe, Mail, Code, BarChart3, Search, FileText, Image, Shield, Terminal, Cpu, Eye, BookOpen, Languages, Video, Calendar, Rss, Network).
8. connection_type must be one of: llm, oauth, api_key, cli, none.
9. Every command MUST have: name, description, parameters (array), returns (object with type + description).
10. Parameter types: string, number, boolean, array, object.
11. Every parameter MUST have: name, type, required, description. Optional params should have a default.

EXECUTION STYLES (pick ONE per command):

A) LLM-powered (connection_type: "llm"):
   - Add "system_prompt" and/or "prompt_template" to the command.
   - Use {param_name} for interpolation from parameters.
   - Also set top-level "models" and "default_model".

B) Declarative HTTP (connection_type: "api_key" or "none"):
   - Add "request" object: { "method": "GET|POST", "path": "/endpoint", "query": {...}, "body": {...} }
   - Add "response" object: { "extract": { "field": "dot.path" } } or { "passthrough": true }
   - Add "output_template": "Markdown with {field} placeholders"
   - Also set top-level "api_config" with base_url, vault_service, etc.

C) Named handler (connection_type: "api_key"):
   - Set top-level "execution_handler" to a handler name.
   - This requires custom TypeScript code in the runtime.
   - Only use when A or B won't work (complex auth, binary data, multi-step).

WHEN THE USER DESCRIBES A SKILL:
1. Ask clarifying questions if the connection type or API details are unclear.
2. Pick the simplest execution style that works (prefer A or B over C).
3. For LLM skills: write a good system_prompt that makes the LLM behave as a specialist.
4. For API skills: include realistic request/response config if you know the API.
5. Set risk_level to "moderate" for CLI skills, "dangerous" for shell/sudo access, "safe" for everything else.
6. Include tags for discoverability.
7. Start version at "0.1.0" for new skills.
```

</details>

**Usage**: Paste the system prompt above into your LLM, then describe the skill you want. Example:

> "Create a skill that checks if a website is up or down by pinging it. It should use the free isitdown API. No API key needed."

The LLM will output a valid skill JSON file you can save to `Marketplace/<your-name>/check-website-status.json`.

### Manual Creation

1. Copy an existing skill JSON from `Official/` as a starting point
2. Change the `id`, `title`, `description`, and other metadata
3. Define your commands with parameters and returns
4. Add execution config (`system_prompt` for LLM, `request`/`response` for HTTP)
5. Validate against the schema (see Testing below)

### Quick Templates

**LLM skill** (simplest -- just needs a good prompt):
```json
{
  "id": "my-llm-skill",
  "title": "My LLM Skill",
  "description": "Describe what it does",
  "version": "0.1.0",
  "author": "Your Name",
  "category": "analysis",
  "icon": "Sparkles",
  "connection_type": "llm",
  "models": ["Claude Opus 4.6", "Claude Sonnet 4.5", "GPT-4o", "Gemini 2.5 Pro"],
  "default_model": "Claude Sonnet 4.5",
  "tags": ["my-tag"],
  "commands": [
    {
      "name": "run",
      "description": "Do the thing",
      "system_prompt": "You are an expert at [domain]. Be concise and accurate.",
      "prompt_template": "{input}",
      "parameters": [
        { "name": "input", "type": "string", "required": true, "description": "The input to process" }
      ],
      "returns": { "type": "string", "description": "The result" }
    }
  ]
}
```

**Free API skill** (no key needed):
```json
{
  "id": "my-api-skill",
  "title": "My API Skill",
  "description": "Calls a free public API",
  "version": "0.1.0",
  "author": "Your Name",
  "category": "research",
  "icon": "Globe",
  "connection_type": "none",
  "api_config": {
    "base_url": "https://api.example.com",
    "vault_service": "none"
  },
  "tags": ["my-tag"],
  "commands": [
    {
      "name": "lookup",
      "description": "Look something up",
      "request": {
        "method": "GET",
        "path": "/endpoint",
        "query": { "q": "{query}" }
      },
      "response": {
        "extract": { "result": "data.result" }
      },
      "output_template": "**Result:** {result}",
      "parameters": [
        { "name": "query", "type": "string", "required": true, "description": "What to look up" }
      ],
      "returns": { "type": "object", "description": "API response" }
    }
  ]
}
```

---

## How to Contribute

We welcome community skill contributions to the Marketplace directory.

### Steps

1. **Fork** this repository
2. **Create** your skill JSON file under `Marketplace/<your-username>/<skill-name>.json`
3. **Validate** your file against the schema (see Testing below)
4. **Submit** a Pull Request with:
   - A clear title describing the skill
   - A description of what the skill does and why it is useful
   - Any external service dependencies noted

### Guidelines

- Follow the JSON Schema exactly -- all required fields must be present
- Use kebab-case for the `id` field
- Use snake_case for command names and parameter names
- Write clear, actionable descriptions
- Include realistic parameter definitions with appropriate defaults
- Tag your skill with relevant keywords for discoverability
- Set `status` to `beta` for new community skills
- Prefer LLM or declarative HTTP execution over named handlers

---

## Testing

Validate your skill file against the schema using any JSON Schema validator:

```bash
# Using ajv-cli (Node.js)
npm install -g ajv-cli
ajv validate -s schema/skill.schema.json -d "Marketplace/**/*.json"

# Using check-jsonschema (Python)
pip install check-jsonschema
check-jsonschema --schemafile schema/skill.schema.json Marketplace/**/*.json
```

To validate all Official skills:

```bash
ajv validate -s schema/skill.schema.json -d "Official/**/*.json"
```

---

## Versioning

Skills follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (1.0.0 -> 2.0.0) -- Breaking changes to commands or parameters
- **MINOR** (1.0.0 -> 1.1.0) -- New commands added, backward-compatible
- **PATCH** (1.0.0 -> 1.0.1) -- Bug fixes, description updates, no interface changes

When updating a skill, always increment the version and update `manifest.json`.

---

## Disclaimer

THIS SOFTWARE AND ALL SKILL DEFINITIONS ARE PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NONINFRINGEMENT.

IN NO EVENT SHALL THE AUTHORS, CONTRIBUTORS, OR JARVIS INC BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT, OR OTHERWISE, ARISING FROM, OUT OF, OR IN CONNECTION WITH THE SOFTWARE, THE SKILL DEFINITIONS, OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

**Important notices:**

- Skills that connect to external APIs (Google, Slack, OpenAI, etc.) may incur usage costs on those platforms. You are solely responsible for any charges incurred by your API keys and OAuth connections.
- Community-contributed skills in the `Marketplace/` directory are NOT reviewed, audited, or endorsed by Jarvis Inc. Use them at your own risk. Review the skill definition and understand what permissions it requests before enabling it.
- Skill definitions describe interfaces only -- they do not guarantee the availability, accuracy, or reliability of the underlying services.
- OAuth scopes and API permissions defined in skill files should be reviewed carefully. Only grant the minimum permissions necessary.
- Jarvis Inc reserves the right to remove any skill from the Official directory or Marketplace at any time.

---

## License

Licensed under the [Apache License, Version 2.0](https://www.apache.org/licenses/LICENSE-2.0).

Copyright 2026 Jarvis Inc. See [LICENSE](LICENSE) for the full license text.
