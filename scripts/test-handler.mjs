#!/usr/bin/env node
// ─── Skill Handler Test Runner ───────────────────────────────────────────────
// Mirrors the gateway execution logic (docker/gateway/server.ts:205-293)
// so skill authors can test handlers locally without the full Jarvis stack.
//
// Usage:
//   node scripts/test-handler.mjs dns-lookup full_report --params '{"domain":"example.com"}'
//   node scripts/test-handler.mjs create-images-gemini generate --dry-run
//   node scripts/test-handler.mjs my-skill my_cmd --api-key sk-xxx --params '{"q":"test"}'
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

// ─── Colors ──────────────────────────────────────────────────────────────────
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

// ─── Parse CLI args ─────────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  if (args.length < 2 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
${BOLD}Usage:${RESET} node scripts/test-handler.mjs <skill-id> <command> [options]

${BOLD}Options:${RESET}
  --params '{"key":"value"}'   JSON parameters for the handler
  --api-key <key>              API key to inject as _apiKey
  --dry-run                    Validate handler exists without executing

${BOLD}Examples:${RESET}
  node scripts/test-handler.mjs dns-lookup full_report --params '{"domain":"example.com"}'
  node scripts/test-handler.mjs fetch-webpage-markdown fetch_page --params '{"url":"https://example.com"}'
  node scripts/test-handler.mjs create-images-gemini generate --dry-run
`);
    process.exit(args.length === 0 ? 1 : 0);
  }

  const skillId = args[0];
  const command = args[1];
  let params = {};
  let apiKey = '';
  let dryRun = false;

  for (let i = 2; i < args.length; i++) {
    if (args[i] === '--params' && args[i + 1]) {
      try {
        params = JSON.parse(args[++i]);
      } catch (e) {
        console.error(`${RED}Invalid JSON for --params:${RESET} ${e.message}`);
        process.exit(1);
      }
    } else if (args[i] === '--api-key' && args[i + 1]) {
      apiKey = args[++i];
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    }
  }

  return { skillId, command, params, apiKey, dryRun };
}

// ─── Find skill directory ───────────────────────────────────────────────────
function findSkillDir(id) {
  for (const topDir of ['Official', 'Marketplace']) {
    const topPath = join(ROOT, topDir);
    if (!existsSync(topPath)) continue;

    for (const category of readdirSync(topPath)) {
      const catPath = join(topPath, category);
      if (!statSync(catPath).isDirectory()) continue;

      const skillPath = join(catPath, id);
      if (existsSync(skillPath) && existsSync(join(skillPath, 'skill.json'))) {
        return skillPath;
      }
    }
  }
  return null;
}

// ─── TypeScript/JS handler execution ────────────────────────────────────────
// Mirrors gateway: dynamic import → call default export with params
async function executeTypeScript(handlerPath, params) {
  const ext = extname(handlerPath);

  // For .ts files, use tsx for transpilation (same as gateway uses)
  if (ext === '.ts') {
    return new Promise((resolve, reject) => {
      // Use node --import tsx/esm with an eval that imports and calls the handler
      const absPath = handlerPath.replaceAll('\\', '/');
      const evalCode = `
        import('file://${absPath}').then(async (mod) => {
          if (typeof mod.default !== 'function') {
            process.stdout.write(JSON.stringify({ error: 'Handler has no default export function' }));
            process.exit(1);
          }
          try {
            const result = await mod.default(${JSON.stringify(params)});
            process.stdout.write(JSON.stringify(result));
          } catch (e) {
            process.stdout.write(JSON.stringify({ error: e.message }));
            process.exit(1);
          }
        }).catch(e => {
          process.stdout.write(JSON.stringify({ error: e.message }));
          process.exit(1);
        });
      `;

      const proc = spawn('node', ['--import', 'tsx/esm', '-e', evalCode], {
        cwd: ROOT,
        timeout: 30_000,
        env: { ...process.env },
      });

      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (d) => { stdout += d; });
      proc.stderr.on('data', (d) => { stderr += d; });
      proc.on('close', (code) => {
        if (code !== 0 && !stdout) {
          return reject(new Error(stderr || `Node exit code ${code}`));
        }
        try {
          resolve(JSON.parse(stdout));
        } catch {
          resolve({ result: stdout.trim() });
        }
      });
      proc.on('error', (err) => {
        if (err.code === 'ENOENT') {
          reject(new Error('tsx is not installed. Run: npm install -g tsx'));
        } else {
          reject(err);
        }
      });
    });
  }

  // For .js files: direct dynamic import
  const mod = await import(handlerPath);
  if (typeof mod.default !== 'function') {
    throw new Error('Handler has no default export function');
  }
  return await mod.default(params);
}

// ─── Python handler execution ───────────────────────────────────────────────
// Mirrors gateway: spawn python3, JSON on stdin, JSON on stdout
function executePython(handlerPath, params) {
  return new Promise((resolve, reject) => {
    const proc = spawn('python3', [handlerPath], { timeout: 30_000 });
    let stdout = '';
    let stderr = '';

    proc.stdin.write(JSON.stringify(params));
    proc.stdin.end();
    proc.stdout.on('data', (d) => { stdout += d; });
    proc.stderr.on('data', (d) => { stderr += d; });
    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error(stderr || `Python exit code ${code}`));
      try { resolve(JSON.parse(stdout)); } catch { resolve({ result: stdout.trim() }); }
    });
    proc.on('error', (err) => {
      if (err.code === 'ENOENT') {
        reject(new Error('python3 is not installed or not in PATH'));
      } else {
        reject(err);
      }
    });
  });
}

// ─── Bash handler execution ────────────────────────────────────────────────
// Mirrors gateway: env vars PARAM_* + API_KEY, stdout is result
function executeBash(handlerPath, params, apiKey) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    for (const [k, v] of Object.entries(params)) {
      if (k === '_apiKey') continue;
      env[`PARAM_${k.toUpperCase()}`] = String(v);
    }
    if (apiKey) env.API_KEY = apiKey;

    const proc = spawn('bash', [handlerPath], { env, timeout: 30_000 });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d; });
    proc.stderr.on('data', (d) => { stderr += d; });
    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error(stderr || `Bash exit code ${code}`));
      try { resolve(JSON.parse(stdout)); } catch { resolve({ result: stdout.trim() }); }
    });
    proc.on('error', reject);
  });
}

// ─── Main ────────────────────────────────────────────────────────────────────
const { skillId, command, params, apiKey, dryRun } = parseArgs();

// Find skill
const skillDir = findSkillDir(skillId);
if (!skillDir) {
  console.error(`${RED}Skill not found:${RESET} ${skillId}`);
  console.error(`Searched Official/*/${skillId}/ and Marketplace/*/${skillId}/`);
  process.exit(1);
}

// Load skill.json
const skillJson = JSON.parse(readFileSync(join(skillDir, 'skill.json'), 'utf-8'));
const cmd = skillJson.commands?.find(c => c.name === command);
if (!cmd) {
  const available = (skillJson.commands || []).map(c => c.name).join(', ');
  console.error(`${RED}Command not found:${RESET} "${command}" in skill "${skillId}"`);
  console.error(`Available commands: ${available}`);
  process.exit(1);
}

if (!cmd.handler_file) {
  console.error(`${RED}No handler_file${RESET} for command "${command}" — this command uses declarative execution (request/response or LLM prompting), not a handler file.`);
  process.exit(1);
}

const handlerPath = resolve(skillDir, cmd.handler_file);
if (!existsSync(handlerPath)) {
  console.error(`${RED}Handler file not found:${RESET} ${cmd.handler_file}`);
  process.exit(1);
}

const ext = extname(handlerPath);
const runtime = skillJson.handler_runtime ||
  (ext === '.ts' ? 'typescript' : ext === '.py' ? 'python' : ext === '.sh' ? 'bash' : 'unknown');

console.log(`\n${BOLD}${CYAN}${skillId}${RESET} → ${command}`);
console.log(`${DIM}Handler:${RESET}  ${cmd.handler_file}`);
console.log(`${DIM}Runtime:${RESET}  ${runtime}`);
console.log(`${DIM}Params:${RESET}   ${JSON.stringify(params)}`);
if (apiKey) console.log(`${DIM}API Key:${RESET}  ${apiKey.slice(0, 8)}...`);

if (dryRun) {
  console.log(`\n${GREEN}DRY RUN:${RESET} Handler exists and is valid. Would execute with ${runtime} runtime.`);

  // Validate required params
  const required = (cmd.parameters || []).filter(p => p.required);
  const missing = required.filter(p => !(p.name in params));
  if (missing.length > 0) {
    console.log(`${YELLOW}Missing required params:${RESET} ${missing.map(p => p.name).join(', ')}`);
  }
  process.exit(0);
}

// Execute
console.log(`\n${DIM}Executing...${RESET}\n`);
const startTime = Date.now();

try {
  const inputParams = { ...params };
  if (apiKey) inputParams._apiKey = apiKey;

  let result;
  if (ext === '.ts' || ext === '.js') {
    result = await executeTypeScript(handlerPath, inputParams);
  } else if (ext === '.py') {
    result = await executePython(handlerPath, inputParams);
  } else if (ext === '.sh') {
    result = await executeBash(handlerPath, params, apiKey);
  } else {
    console.error(`${RED}Unsupported handler extension:${RESET} ${ext}`);
    process.exit(1);
  }

  const elapsed = Date.now() - startTime;

  console.log(`${BOLD}─── Result ───${RESET}`);
  if (typeof result === 'object') {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(result);
  }
  console.log(`\n${GREEN}Completed${RESET} in ${elapsed}ms`);
} catch (err) {
  const elapsed = Date.now() - startTime;
  console.error(`\n${RED}Error${RESET} after ${elapsed}ms: ${err.message}`);
  process.exit(1);
}
