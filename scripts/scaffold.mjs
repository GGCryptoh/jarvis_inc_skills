#!/usr/bin/env node
// ─── Skill Scaffolder ────────────────────────────────────────────────────────
// Generates a new skill directory with skill.json skeleton + handler stub.
//
// Usage:
//   node scripts/scaffold.mjs my-skill --runtime typescript --connection api_key --category research
//   node scripts/scaffold.mjs my-skill                   # interactive prompts
// ─────────────────────────────────────────────────────────────────────────────

import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

// ─── Colors ──────────────────────────────────────────────────────────────────
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

const CATEGORIES = ['communication', 'research', 'creation', 'analysis'];
const RUNTIMES = ['typescript', 'python', 'bash'];
const CONNECTIONS = ['api_key', 'oauth', 'llm', 'cli', 'channel', 'none'];

// ─── Parse CLI args ─────────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  if (args[0] === '--help' || args[0] === '-h') {
    console.log(`
${BOLD}Usage:${RESET} node scripts/scaffold.mjs <skill-id> [options]

${BOLD}Options:${RESET}
  --runtime <typescript|python|bash>                Handler runtime
  --connection <api_key|oauth|llm|cli|channel|none> Connection type
  --category <communication|research|creation|analysis>  Skill category

${BOLD}Examples:${RESET}
  node scripts/scaffold.mjs weather-api --runtime typescript --connection api_key --category research
  node scripts/scaffold.mjs my-tool     ${DIM}# interactive mode${RESET}
`);
    process.exit(0);
  }

  const skillId = args[0];
  let runtime = null;
  let connection = null;
  let category = null;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--runtime' && args[i + 1]) runtime = args[++i];
    else if (args[i] === '--connection' && args[i + 1]) connection = args[++i];
    else if (args[i] === '--category' && args[i + 1]) category = args[++i];
  }

  return { skillId, runtime, connection, category };
}

// ─── Interactive prompt ─────────────────────────────────────────────────────
function ask(rl, question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function promptMissing(config) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  if (!config.skillId) {
    config.skillId = await ask(rl, `${BOLD}Skill ID${RESET} (kebab-case, e.g. weather-api): `);
  }

  if (!config.category) {
    console.log(`\n${BOLD}Categories:${RESET} ${CATEGORIES.join(', ')}`);
    config.category = await ask(rl, `${BOLD}Category${RESET} [research]: `);
    if (!config.category) config.category = 'research';
  }

  if (!config.connection) {
    console.log(`\n${BOLD}Connection types:${RESET} ${CONNECTIONS.join(', ')}`);
    config.connection = await ask(rl, `${BOLD}Connection type${RESET} [api_key]: `);
    if (!config.connection) config.connection = 'api_key';
  }

  if (!config.runtime) {
    console.log(`\n${BOLD}Runtimes:${RESET} ${RUNTIMES.join(', ')}`);
    config.runtime = await ask(rl, `${BOLD}Handler runtime${RESET} [typescript]: `);
    if (!config.runtime) config.runtime = 'typescript';
  }

  rl.close();
  return config;
}

// ─── Validate inputs ────────────────────────────────────────────────────────
function validate(config) {
  if (!config.skillId || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(config.skillId)) {
    console.error(`${RED}Invalid skill ID:${RESET} "${config.skillId}" — must be kebab-case (e.g. my-skill)`);
    process.exit(1);
  }
  if (!CATEGORIES.includes(config.category)) {
    console.error(`${RED}Invalid category:${RESET} "${config.category}" — must be one of: ${CATEGORIES.join(', ')}`);
    process.exit(1);
  }
  if (!CONNECTIONS.includes(config.connection)) {
    console.error(`${RED}Invalid connection:${RESET} "${config.connection}" — must be one of: ${CONNECTIONS.join(', ')}`);
    process.exit(1);
  }
  if (!RUNTIMES.includes(config.runtime)) {
    console.error(`${RED}Invalid runtime:${RESET} "${config.runtime}" — must be one of: ${RUNTIMES.join(', ')}`);
    process.exit(1);
  }
}

// ─── Handler templates ──────────────────────────────────────────────────────
function tsHandler(skillId) {
  return `// ${skillId} handler
// Receives params object (plus _apiKey if connection_type is api_key)
// Must return { result: string }

export default async function(params: Record<string, unknown>): Promise<{ result: string }> {
  const apiKey = params._apiKey as string;
  // TODO: implement your handler logic here

  // Example: call an external API
  // const resp = await fetch('https://api.example.com/endpoint', {
  //   headers: { 'Authorization': \`Bearer \${apiKey}\` },
  // });
  // const data = await resp.json();

  return { result: 'TODO: return your result here' };
}
`;
}

function pyHandler(skillId) {
  return `"""${skillId} handler.

Reads JSON from stdin: { "param_name": "value", "_apiKey": "..." }
Writes JSON to stdout: { "result": "..." }
"""
import json
import sys

def main():
    params = json.loads(sys.stdin.read())
    api_key = params.get("_apiKey", "")
    # TODO: implement your handler logic here

    # Example: call an external API
    # from urllib.request import Request, urlopen
    # req = Request("https://api.example.com/endpoint")
    # req.add_header("Authorization", f"Bearer {api_key}")
    # resp = urlopen(req)
    # data = json.loads(resp.read())

    json.dump({"result": "TODO: return your result here"}, sys.stdout)

if __name__ == "__main__":
    main()
`;
}

function bashHandler(skillId) {
  return `#!/usr/bin/env bash
# ${skillId} handler
# Receives params as PARAM_* env vars and API_KEY
# Must output JSON to stdout: { "result": "..." }

# Available env vars:
# PARAM_<NAME> — each parameter in uppercase
# API_KEY      — API key from the vault (if connection_type is api_key)

# TODO: implement your handler logic here

# Example:
# RESPONSE=$(curl -s -H "Authorization: Bearer $API_KEY" "https://api.example.com/endpoint?q=$PARAM_QUERY")
# echo "{\\"result\\": \\"$RESPONSE\\"}"

echo '{"result": "TODO: return your result here"}'
`;
}

// ─── Skill JSON template ────────────────────────────────────────────────────
function buildSkillJson(config) {
  const handlerExt = { typescript: '.ts', python: '.py', bash: '.sh' }[config.runtime];
  const handlerFile = `handlers/example${handlerExt}`;

  const skill = {
    id: config.skillId,
    title: config.skillId.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' '),
    description: `TODO: describe what ${config.skillId} does (10-500 chars)`,
    version: '0.1.0',
    author: 'TODO: your name',
    category: config.category,
    icon: 'Wrench',
    tags: [],
    status: 'available',
    connection_type: config.connection,
    models: config.connection === 'llm'
      ? ['Claude Sonnet 4.5', 'GPT-5.2', 'Gemini 2.5 Flash']
      : null,
    default_model: config.connection === 'llm' ? 'Claude Sonnet 4.5' : null,
    fixed_service: null,
    service_type: config.connection === 'api_key' ? 'fixed' : null,
    oauth_config: null,
    curl_example: null,
    cli_config: null,
    api_config: config.connection === 'api_key' ? {
      base_url: 'https://api.example.com',
      vault_service: 'TODO_service_name',
    } : null,
    execution_handler: null,
    output_type: 'text',
    collateral: true,
    risk_level: 'safe',
    handler_runtime: config.connection === 'llm' ? null : config.runtime,
    files: config.connection === 'llm' ? null : [handlerFile],
    commands: [],
  };

  if (config.connection === 'llm') {
    skill.commands.push({
      name: 'execute',
      description: 'TODO: describe this command',
      system_prompt: 'TODO: system prompt for the LLM',
      prompt_template: 'TODO: user message with {param} interpolation',
      parameters: [
        { name: 'input', type: 'string', required: true, description: 'TODO: describe this parameter' },
      ],
      returns: { type: 'string', description: 'TODO: describe the return value' },
    });
  } else {
    skill.commands.push({
      name: 'execute',
      description: 'TODO: describe this command',
      handler_file: handlerFile,
      parameters: [
        { name: 'input', type: 'string', required: true, description: 'TODO: describe this parameter' },
      ],
      returns: { type: 'string', description: 'TODO: describe the return value' },
    });
  }

  return skill;
}

// ─── Main ────────────────────────────────────────────────────────────────────
let config = parseArgs();

// Interactive mode for missing args
const needsInteractive = !config.skillId || !config.runtime || !config.connection || !config.category;
if (needsInteractive) {
  config = await promptMissing(config);
}

validate(config);

const skillDir = join(ROOT, 'Official', config.category, config.skillId);

if (existsSync(skillDir)) {
  console.error(`${RED}Directory already exists:${RESET} ${skillDir}`);
  process.exit(1);
}

// Create directories
mkdirSync(skillDir, { recursive: true });
if (config.connection !== 'llm') {
  mkdirSync(join(skillDir, 'handlers'), { recursive: true });
}

// Write skill.json
const skillJson = buildSkillJson(config);
writeFileSync(join(skillDir, 'skill.json'), JSON.stringify(skillJson, null, 2) + '\n');

// Write handler stub (unless LLM-only)
if (config.connection !== 'llm') {
  const handlerExt = { typescript: '.ts', python: '.py', bash: '.sh' }[config.runtime];
  const handlerPath = join(skillDir, 'handlers', `example${handlerExt}`);
  const template = {
    typescript: tsHandler,
    python: pyHandler,
    bash: bashHandler,
  }[config.runtime];
  writeFileSync(handlerPath, template(config.skillId));
}

console.log(`
${GREEN}${BOLD}Skill scaffolded!${RESET}

  ${CYAN}Directory:${RESET}  Official/${config.category}/${config.skillId}/
  ${CYAN}Runtime:${RESET}    ${config.runtime}
  ${CYAN}Connection:${RESET} ${config.connection}

${BOLD}Next steps:${RESET}
  1. Edit ${DIM}skill.json${RESET} — fill in title, description, author, parameters
  2. ${config.connection !== 'llm' ? `Edit ${DIM}handlers/example${({ typescript: '.ts', python: '.py', bash: '.sh' })[config.runtime]}${RESET} — implement your handler logic` : `Edit ${DIM}skill.json${RESET} — write system_prompt and prompt_template`}
  3. Validate:    ${DIM}node scripts/validate.mjs Official/${config.category}/${config.skillId}/${RESET}
  4. Test:        ${config.connection !== 'llm' ? `${DIM}node scripts/test-handler.mjs ${config.skillId} execute --params '{"input":"test"}'${RESET}` : `${DIM}(LLM skills are tested via the Skill Test Dialog in the dashboard)${RESET}`}
  5. Update manifest: ${DIM}node scripts/update-manifest.mjs${RESET}
`);
