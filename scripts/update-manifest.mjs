#!/usr/bin/env node
// ─── Manifest Generator ─────────────────────────────────────────────────────
// Walks Official/ and Marketplace/ to build manifest.json.
// Computes SHA-256 checksums that match skillResolver.ts:sha256().
//
// Usage:
//   node scripts/update-manifest.mjs
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

// ─── Colors ──────────────────────────────────────────────────────────────────
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

// ─── SHA-256 matching skillResolver.ts ──────────────────────────────────────
// skillResolver uses Web Crypto: TextEncoder().encode(text) → SHA-256
// Node's crypto.createHash('sha256').update(text, 'utf8') produces the same hash
function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

// ─── Discover skills ────────────────────────────────────────────────────────
function discoverSkills() {
  const skills = [];

  for (const topDir of ['Official', 'Marketplace']) {
    const topPath = join(ROOT, topDir);
    if (!existsSync(topPath)) continue;

    for (const entry of readdirSync(topPath)) {
      const entryPath = join(topPath, entry);

      if (!statSync(entryPath).isDirectory()) {
        // Legacy file-type skill at top level (shouldn't exist but handle gracefully)
        if (entry.endsWith('.json')) {
          skills.push({ type: 'file', path: `${topDir}/${entry}` });
        }
        continue;
      }

      // Category directory
      for (const item of readdirSync(entryPath)) {
        const itemPath = join(entryPath, item);

        if (statSync(itemPath).isDirectory()) {
          // Directory-type skill
          const skillJsonPath = join(itemPath, 'skill.json');
          if (existsSync(skillJsonPath)) {
            skills.push({
              type: 'directory',
              path: `${topDir}/${entry}/${item}`,
              fullPath: itemPath,
            });
          }
        } else if (item.endsWith('.json')) {
          // Legacy single-file skill inside category
          skills.push({
            type: 'file',
            path: `${topDir}/${entry}/${item}`,
            fullPath: itemPath,
          });
        }
      }
    }
  }

  // Sort by path for deterministic output
  skills.sort((a, b) => a.path.localeCompare(b.path));
  return skills;
}

// ─── Build manifest entry ───────────────────────────────────────────────────
function buildEntry(skill) {
  if (skill.type === 'file') {
    const content = readFileSync(join(ROOT, skill.path), 'utf-8');
    return {
      path: skill.path,
      type: 'file',
      checksum: sha256(content),
    };
  }

  // Directory type
  const skillDir = join(ROOT, skill.path);
  const skillJsonPath = join(skillDir, 'skill.json');
  const skillJsonContent = readFileSync(skillJsonPath, 'utf-8');
  const skillJson = JSON.parse(skillJsonContent);

  // Build files array: start with skill.json, then handler files
  const files = ['skill.json'];
  const handlersDir = join(skillDir, 'handlers');
  if (existsSync(handlersDir) && statSync(handlersDir).isDirectory()) {
    for (const f of readdirSync(handlersDir).sort()) {
      if (!f.startsWith('.')) {
        files.push(`handlers/${f}`);
      }
    }
  }

  // Also check for any other declared files not in handlers/
  if (skillJson.files) {
    for (const f of skillJson.files) {
      if (!files.includes(f) && existsSync(join(skillDir, f))) {
        files.push(f);
      }
    }
  }

  return {
    path: skill.path,
    type: 'directory',
    manifest_file: 'skill.json',
    files,
    checksum: sha256(skillJsonContent),
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────
console.log(`${BOLD}Scanning for skills...${RESET}\n`);

const skills = discoverSkills();
const entries = [];

for (const skill of skills) {
  try {
    const entry = buildEntry(skill);
    entries.push(entry);
    console.log(`  ${GREEN}+${RESET} ${skill.path} ${DIM}(${entry.checksum.slice(0, 12)}...)${RESET}`);
  } catch (err) {
    console.log(`  ${YELLOW}!${RESET} ${skill.path}: ${err.message}`);
  }
}

// Read existing manifest for comparison
const manifestPath = join(ROOT, 'manifest.json');
let existingManifest = null;
if (existsSync(manifestPath)) {
  try {
    existingManifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  } catch { /* ignore parse errors */ }
}

const manifest = {
  version: '0.3.0',
  format: 'mixed',
  updated_at: new Date().toISOString().replace(/\.\d{3}Z/, 'Z'),
  skills: entries,
};

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

console.log(`\n${BOLD}─── Summary ───${RESET}`);
console.log(`  Skills: ${entries.length}`);

// Compare with previous
if (existingManifest?.skills) {
  const oldMap = new Map(existingManifest.skills.map(s => [s.path, s.checksum]));
  let changed = 0;
  let added = 0;
  for (const entry of entries) {
    const old = oldMap.get(entry.path);
    if (!old) added++;
    else if (old !== entry.checksum) changed++;
  }
  const removed = existingManifest.skills.filter(s => !entries.find(e => e.path === s.path)).length;

  if (added > 0) console.log(`  ${GREEN}Added:${RESET}   ${added}`);
  if (changed > 0) console.log(`  ${YELLOW}Changed:${RESET} ${changed}`);
  if (removed > 0) console.log(`  ${YELLOW}Removed:${RESET} ${removed}`);
  if (added === 0 && changed === 0 && removed === 0) {
    console.log(`  ${DIM}No changes${RESET}`);
  }
}

console.log(`\n  ${CYAN}Wrote${RESET} manifest.json\n`);
