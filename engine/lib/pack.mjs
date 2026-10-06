// Type-pack resolver, contract v0.
//
// A site's "type" (site.config.json) names a directory types/<type>/ whose
// pack.mjs default-exports the pack. Contract v0 (MASTER-PLAN 3.2, D-28):
//
//   {
//     id: '<type>',                       // equals the directory name
//     version: 'x.y.z',
//     status: 'full' | 'stub',            // 'stub' adds the type-stub lint (warning; error under --strict)
//     lintPrefix: 'sc',                   // every lint.rules[].id starts with '<prefix>.'
//     pages(ctx, common) -> page[],       // the ordered page list; common = the engine's
//                                         //   { about, terms, privacy, cookies, contact, notFound, offline }
//     styles: { partials: ['10-base.css', …],     // engine/styles partials in order (the site's
//               extraCss?(ctx) -> string },        //   theme/tokens.css goes first); generated CSS appended last
//     mandatory: { pageLints: ['<prefix>.<id>', …] }, // ids of lint.rules a site can never switch off
//     lint: { rules: [{ id, phase, level, factory?, run(input, report) }] },  // phases: PHASES below
//     checks: { builds: { <name>: { edit(cfg) -> cfg, sections: [ids] } } },
//     templateSite: 'template-site',      // directory, relative to the pack
//     chrome?: 'full' | 'basic',          // Phase 1: which engine/lib/layout.mjs chrome wraps the pages
//                                         //   (default 'full'); pack.chrome objects arrive in Phase 2
//     manifest?(ctx, manifest) -> manifest,  // adjust the web app manifest
//   }
//
// engine/schema/pack.schema.json describes the same surface for tools.

import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DEFAULT_TYPE } from './pack-resolver-default.mjs';

export const PHASES = ['file', 'file-end', 'page', 'markup-chrome', 'markup', 'site', 'config'];
const LEVELS = ['error', 'strict', 'warn'];

/** Which type a config builds as, and whether it fell back to the default. */
export function typeOf(cfg) {
  return typeof cfg.type === 'string' && cfg.type ? { type: cfg.type, defaulted: false } : { type: DEFAULT_TYPE, defaulted: true };
}

/** Problems with a pack's v0 surface, as strings (empty when it is valid). */
export function packProblems(pack, type) {
  const out = [];
  const at = `types/${type}/pack.mjs`;
  if (!pack || typeof pack !== 'object') return [`${at}: no default export`];
  if (pack.id !== type) out.push(`${at}: id is "${pack.id}", expected "${type}"`);
  if (typeof pack.version !== 'string' || !/^\d+\.\d+\.\d+/.test(pack.version)) out.push(`${at}: version must be semver`);
  if (!['full', 'stub'].includes(pack.status)) out.push(`${at}: status must be "full" or "stub"`);
  if (typeof pack.lintPrefix !== 'string' || !/^[a-z]+$/.test(pack.lintPrefix)) out.push(`${at}: lintPrefix must be lower-case letters`);
  if (typeof pack.pages !== 'function') out.push(`${at}: pages(ctx, common) is required`);
  if (!Array.isArray(pack.styles?.partials) || !pack.styles.partials.every((p) => typeof p === 'string' && p.endsWith('.css'))) {
    out.push(`${at}: styles.partials must be a list of engine/styles/*.css names`);
  }
  if (pack.styles?.extraCss !== undefined && typeof pack.styles.extraCss !== 'function') out.push(`${at}: styles.extraCss must be a function`);
  if (pack.chrome !== undefined && !['full', 'basic'].includes(pack.chrome)) out.push(`${at}: chrome must be "full" or "basic"`);
  if (pack.manifest !== undefined && typeof pack.manifest !== 'function') out.push(`${at}: manifest must be a function`);
  const rules = pack.lint?.rules ?? [];
  if (!Array.isArray(rules)) out.push(`${at}: lint.rules must be a list`);
  const ids = new Set();
  for (const r of Array.isArray(rules) ? rules : []) {
    if (typeof r?.id !== 'string' || !r.id.startsWith(`${pack.lintPrefix}.`)) out.push(`${at}: lint rule id "${r?.id}" must start with "${pack.lintPrefix}."`);
    if (ids.has(r?.id)) out.push(`${at}: lint rule id "${r.id}" is used twice`);
    ids.add(r?.id);
    if (!PHASES.includes(r?.phase)) out.push(`${at}: lint rule ${r?.id} has phase "${r?.phase}" (use ${PHASES.join(', ')})`);
    if (!LEVELS.includes(r?.level)) out.push(`${at}: lint rule ${r?.id} has level "${r?.level}" (use ${LEVELS.join(', ')})`);
    if (typeof r?.run !== 'function') out.push(`${at}: lint rule ${r?.id} has no run()`);
  }
  for (const id of pack.mandatory?.pageLints ?? []) if (!ids.has(id)) out.push(`${at}: mandatory.pageLints names "${id}", which lint.rules doesn't define`);
  for (const [name, b] of Object.entries(pack.checks?.builds ?? {})) {
    if (typeof b?.edit !== 'function') out.push(`${at}: checks.builds.${name}.edit(cfg) is required`);
    if (!Array.isArray(b?.sections)) out.push(`${at}: checks.builds.${name}.sections must be a list`);
  }
  return out;
}

/**
 * A pack as JSON, for engine/schema/pack.schema.json: every function becomes
 * the string "function" (tools/engine-lint.mjs --packs validates this).
 */
export function projectPack(value) {
  if (typeof value === 'function') return 'function';
  if (Array.isArray(value)) return value.map(projectPack);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([k]) => k !== 'dir').map(([k, v]) => [k, projectPack(v)]));
  return value;
}

/**
 * Load types/<type>/pack.mjs from the TYPES root. Throws with a readable
 * message when the type has no pack or the pack breaks the v0 contract.
 */
export async function loadPack(TYPES, type) {
  if (!/^[a-z][a-z0-9-]*$/.test(type)) throw new Error(`site.config.json: type "${type}" isn't a type name`);
  const file = path.join(TYPES, type, 'pack.mjs');
  if (!existsSync(file)) throw new Error(`site.config.json: type "${type}" has no pack (${path.relative(process.cwd(), file) || file} doesn't exist)`);
  const pack = (await import(pathToFileURL(file).href)).default;
  const problems = packProblems(pack, type);
  if (problems.length) throw new Error(problems.join('\n'));
  return { ...pack, dir: path.dirname(file) };
}
