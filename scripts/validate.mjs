#!/usr/bin/env node
// ─── Skill Validator ─────────────────────────────────────────────────────────
// Validates a skill directory against the JSON Schema and checks structural
// integrity (handler files exist, files array matches, id matches dir name).
//
// Usage:
//   node scripts/validate.mjs Official/research/dns-lookup/
//   node scripts/validate.mjs                                  # validates ALL skills
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, basename, resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

// ─── Colors ──────────────────────────────────────────────────────────────────
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

function error(msg) { console.log(`  ${RED}ERROR${RESET} ${msg}`); }
function warn(msg) { console.log(`  ${YELLOW}WARN${RESET}  ${msg}`); }
function pass(msg) { console.log(`  ${GREEN}PASS${RESET}  ${msg}`); }

// ─── Schema loading ─────────────────────────────────────────────────────────
function loadSchema() {
  const schemaPath = join(ROOT, 'schema', 'skill.schema.json');
  if (!existsSync(schemaPath)) {
    console.error(`${RED}Schema not found:${RESET} ${schemaPath}`);
    process.exit(1);
  }
  const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(schema);
}

// ─── Schema validation ──────────────────────────────────────────────────────
function validateSchema(validate, skillJson) {
  const valid = validate(skillJson);
  const errors = [];
  if (!valid && validate.errors) {
    for (const err of validate.errors) {
      const path = err.instancePath || '/';
      const msg = err.message || 'unknown error';
      const extra = err.params?.allowedValues
        ? ` (allowed: ${err.params.allowedValues.join(', ')})`
        : '';
      errors.push(`${path}: ${msg}${extra}`);
    }
  }
  return errors;
}

// ─── Structural validation ──────────────────────────────────────────────────
function validateStructure(skillDir, skillJson) {
  const errors = [];
  const warnings = [];

  // 1. Skill id must match directory name
  const dirName = basename(skillDir);
  if (skillJson.id !== dirName) {
    errors.push(`Skill id "${skillJson.id}" does not match directory name "${dirName}"`);
  }

  // 2. Check handler_file paths exist on disk
  const commandNames = new Set();
  for (const cmd of skillJson.commands || []) {
    // 2a. Unique command names
    if (commandNames.has(cmd.name)) {
      errors.push(`Duplicate command name: "${cmd.name}"`);
    }
    commandNames.add(cmd.name);

    // 2b. handler_file exists
    if (cmd.handler_file) {
      const handlerPath = join(skillDir, cmd.handler_file);
      if (!existsSync(handlerPath)) {
        errors.push(`handler_file "${cmd.handler_file}" for command "${cmd.name}" not found on disk`);
      }
    }
  }

  // 3. handler_runtime must be set when any command uses handler_file
  const hasHandlerFiles = (skillJson.commands || []).some(c => c.handler_file);
  if (hasHandlerFiles && !skillJson.handler_runtime) {
    errors.push(`handler_runtime must be set when commands use handler_file`);
  }

  // 4. files array vs actual handler files
  const declaredFiles = skillJson.files || [];
  if (hasHandlerFiles && declaredFiles.length === 0) {
    warnings.push(`Skill has handler_file commands but no "files" array declared`);
  }

  // Check declared files exist on disk
  for (const f of declaredFiles) {
    const filePath = join(skillDir, f);
    if (!existsSync(filePath)) {
      errors.push(`Declared file "${f}" not found on disk`);
    }
  }

  // Check for undeclared handler files on disk
  const handlersDir = join(skillDir, 'handlers');
  if (existsSync(handlersDir) && statSync(handlersDir).isDirectory()) {
    const actualHandlers = readdirSync(handlersDir)
      .filter(f => !f.startsWith('.'))
      .map(f => `handlers/${f}`);
    for (const h of actualHandlers) {
      if (!declaredFiles.includes(h)) {
        warnings.push(`Handler file "${h}" exists on disk but is not in the "files" array`);
      }
    }
  }

  // 5. handler_runtime matches handler file extensions
  if (skillJson.handler_runtime) {
    const expectedExts = {
      typescript: ['.ts', '.js'],
      python: ['.py'],
      bash: ['.sh'],
    };
    const allowed = expectedExts[skillJson.handler_runtime] || [];
    for (const cmd of skillJson.commands || []) {
      if (cmd.handler_file) {
        const ext = extname(cmd.handler_file);
        if (allowed.length > 0 && !allowed.includes(ext)) {
          warnings.push(`Command "${cmd.name}" handler "${cmd.handler_file}" has extension "${ext}" but handler_runtime is "${skillJson.handler_runtime}"`);
        }
      }
    }
  }

  return { errors, warnings };
}

// ─── Validate a single skill directory ──────────────────────────────────────
function validateSkillDir(skillDir, validate) {
  const absDir = resolve(ROOT, skillDir);
  const skillJsonPath = join(absDir, 'skill.json');

  if (!existsSync(skillJsonPath)) {
    console.log(`\n${BOLD}${CYAN}${skillDir}${RESET}`);
    error(`skill.json not found at ${skillJsonPath}`);
    return false;
  }

  let skillJson;
  try {
    skillJson = JSON.parse(readFileSync(skillJsonPath, 'utf-8'));
  } catch (e) {
    console.log(`\n${BOLD}${CYAN}${skillDir}${RESET}`);
    error(`Failed to parse skill.json: ${e.message}`);
    return false;
  }

  console.log(`\n${BOLD}${CYAN}${skillJson.id || skillDir}${RESET} (${skillDir})`);

  // Schema validation
  const schemaErrors = validateSchema(validate, skillJson);
  for (const e of schemaErrors) error(`Schema: ${e}`);

  // Structural validation
  const { errors: structErrors, warnings } = validateStructure(absDir, skillJson);
  for (const e of structErrors) error(e);
  for (const w of warnings) warn(w);

  const totalErrors = schemaErrors.length + structErrors.length;
  if (totalErrors === 0) {
    pass(`Valid (v${skillJson.version || '?'}, ${skillJson.commands?.length || 0} commands)`);
  }

  return totalErrors === 0;
}

// ─── Validate a legacy single-file skill (.json) ───────────────────────────
function validateLegacyFile(filePath, validate) {
  const absPath = resolve(ROOT, filePath);

  if (!existsSync(absPath)) {
    console.log(`\n${BOLD}${CYAN}${filePath}${RESET}`);
    error(`File not found: ${absPath}`);
    return false;
  }

  let skillJson;
  try {
    skillJson = JSON.parse(readFileSync(absPath, 'utf-8'));
  } catch (e) {
    console.log(`\n${BOLD}${CYAN}${filePath}${RESET}`);
    error(`Failed to parse: ${e.message}`);
    return false;
  }

  console.log(`\n${BOLD}${CYAN}${skillJson.id || filePath}${RESET} (${filePath}) [legacy file]`);

  const schemaErrors = validateSchema(validate, skillJson);
  for (const e of schemaErrors) error(`Schema: ${e}`);

  // Check unique command names
  const cmdNames = new Set();
  let dupeErrors = 0;
  for (const cmd of skillJson.commands || []) {
    if (cmdNames.has(cmd.name)) {
      error(`Duplicate command name: "${cmd.name}"`);
      dupeErrors++;
    }
    cmdNames.add(cmd.name);
  }

  const totalErrors = schemaErrors.length + dupeErrors;
  if (totalErrors === 0) {
    pass(`Valid (v${skillJson.version || '?'}, ${skillJson.commands?.length || 0} commands)`);
  }
  return totalErrors === 0;
}

// ─── Discover all skills ────────────────────────────────────────────────────
function discoverAllSkills() {
  const skills = [];
  for (const topDir of ['Official', 'Marketplace']) {
    const topPath = join(ROOT, topDir);
    if (!existsSync(topPath)) continue;

    for (const category of readdirSync(topPath)) {
      const catPath = join(topPath, category);
      if (!statSync(catPath).isDirectory()) {
        // Legacy file-type skill (e.g. research_web.json, skill_factory.json)
        if (category.endsWith('.json')) {
          skills.push({ type: 'file', path: `${topDir}/${category}` });
        }
        continue;
      }

      for (const entry of readdirSync(catPath)) {
        const entryPath = join(catPath, entry);
        if (statSync(entryPath).isDirectory()) {
          // Directory-type skill
          skills.push({ type: 'directory', path: `${topDir}/${category}/${entry}` });
        } else if (entry.endsWith('.json')) {
          // Legacy file-type skill inside a category dir
          skills.push({ type: 'file', path: `${topDir}/${category}/${entry}` });
        }
      }
    }
  }
  return skills;
}

// ─── Main ────────────────────────────────────────────────────────────────────
const validate = loadSchema();
const args = process.argv.slice(2);

let targets;
if (args.length > 0) {
  // Validate specific path(s)
  targets = args.map(arg => {
    const cleaned = arg.replace(/\/+$/, ''); // strip trailing slash
    const absPath = resolve(ROOT, cleaned);
    if (existsSync(join(absPath, 'skill.json'))) {
      return { type: 'directory', path: cleaned };
    } else if (cleaned.endsWith('.json') && existsSync(absPath)) {
      return { type: 'file', path: cleaned };
    } else {
      return { type: 'directory', path: cleaned }; // let it fail with a clear error
    }
  });
} else {
  targets = discoverAllSkills();
}

console.log(`${BOLD}Validating ${targets.length} skill(s)...${RESET}`);

let passed = 0;
let failed = 0;

for (const target of targets) {
  const ok = target.type === 'file'
    ? validateLegacyFile(target.path, validate)
    : validateSkillDir(target.path, validate);
  if (ok) passed++;
  else failed++;
}

console.log(`\n${BOLD}─── Results ───${RESET}`);
console.log(`  ${GREEN}Passed:${RESET} ${passed}`);
if (failed > 0) console.log(`  ${RED}Failed:${RESET} ${failed}`);
console.log();

process.exit(failed > 0 ? 1 : 0);
