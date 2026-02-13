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

Skills are declarative -- they describe the interface, not the implementation. The Jarvis Inc runtime reads these definitions to present capabilities in the dashboard, handle authentication flows, and route agent tasks to the correct backends.

---

## Repository Structure

```
seed_skills_repo/
|-- manifest.json                         # Master index of all skills with paths and checksums
|-- schema/
|   +-- skill.schema.json                 # JSON Schema for validating skill files
|-- Official/                             # Maintained by Jarvis Inc
|   |-- README.md
|   |-- communication/
|   |-- research/
|   |   |-- research_web.json             # Web search, page analysis, fact-checking (LLM)
|   |-- creation/
|   +-- analysis/
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

### Connection Types

| Type | Description | Required Config |
|------|-------------|-----------------|
| `llm` | Powered by a language model. User selects which model to use. | `models`, `default_model` |
| `oauth` | Connects via OAuth 2.0 flow (e.g. Google, Slack). | `oauth_config`, `fixed_service` |
| `api_key` | Authenticates with an API key (e.g. OpenAI). | `fixed_service` |
| `cli` | Wraps a local command-line tool. | `cli_config` |
| `none` | No external connection needed. | -- |

### Command Definition

Each skill must have at least one command. Commands define the actions agents can perform.

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
