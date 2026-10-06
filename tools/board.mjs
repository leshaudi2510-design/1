#!/usr/bin/env node
// Board rows: build and validate the documents the Board artifact keeps in its db
// (SPEC 13.1, MASTER-PLAN 4.6; ECC A-97 validation rules).

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, runMain, UsageError, repoRoot, exists, readJson, readJsonIf, writeJson, isMain } from './lib/common.mjs';
import { SchemaSet, validate } from './lib/jsonschema.mjs';
import { portfolio, loadStages } from './lib/state.mjs';
import { approvalItemsFor } from './lib/order.mjs';
import { lightFingerprint } from './lib/sites.mjs';

const HELP = `Usage:
  node tools/board.mjs row <slug> [--out FILE] [--envelope]
  node tools/board.mjs row <collection> <id> [--out FILE] [--envelope]
  node tools/board.mjs validate <file> [--collection C]
  node tools/board.mjs batch <file>
  node tools/board.mjs event --slug S --kind K --severity SEV --text T [--ref R]

row       builds one Board document from the repository: orders/<orderId>
          (from orders/<id>/order.json + reports/<id>/*.json; the shape of
          reports/<slug>/board-row.json) or sites/<slug> (site config, registry
          or seed stage, reports). With one argument: orders/<slug> when
          orders/<slug>/order.json exists, else sites/<slug>. Prints the bare
          document (--envelope wraps it as { collection, id, data } for
          ArtifactData); --out also writes it.
validate  checks a document (bare or enveloped) against its collection in
          schemas/board.schema.json (partition G) when that file exists, else
          against a minimal built-in shape (SPEC 13.1), plus freshness/ref rules:
          stage in schemas/stages.json, ISO timestamps, slug pattern.
          The collection is --collection, the envelope's, or inferred
          (orderId -> orders, slug + brand -> sites, kind -> events).
batch     validates a JSON array or JSONL of envelopes and prints
          { "writes": [{ "op": "set", "collection", "doc_id", "data" }] } for an
          ArtifactData batch; exit 1 if any row is invalid.
event     prints one events/<ulid> envelope (kinds session ci review health
          lighthouse uniqueness ship deploy incident intake ppc policy).
Exit codes: 0 ok, 1 invalid, 2 usage error.
`;

const EVENT_KINDS = ['session', 'ci', 'review', 'health', 'lighthouse', 'uniqueness', 'ship', 'deploy', 'incident', 'intake', 'ppc', 'policy'];
const SEVERITIES = ['info', 'warn', 'red', 'green'];
const SLUG = '^[a-z][a-z0-9-]{2,39}$';
const ISO = '^\\d{4}-\\d{2}-\\d{2}(T\\d{2}:\\d{2}(:\\d{2}(\\.\\d+)?)?(Z|[+-]\\d{2}:\\d{2})?)?$';

function builtin(stages) {
  const stage = { type: 'string', enum: stages.stages };
  const approval = { type: 'string', enum: ['pending', 'approved', 'rejected', 'changes-requested'] };
  return {
    orders: {
      type: 'object', required: ['orderId', 'slug', 'brand', 'type', 'stage', 'approvals', 'updatedAt'],
      properties: {
        orderId: { type: 'string', pattern: SLUG }, slug: { type: 'string', pattern: SLUG }, brand: { type: 'string', minLength: 1 },
        domain: { type: 'string' }, type: { type: 'string', enum: ['social-casino', 'online-games', 'hotel-casino'] }, variant: { type: 'string' },
        casinoMode: { type: 'string', enum: ['A', 'A+', 'B'] }, audience: { type: 'string' }, markets: { type: 'array', items: { type: 'string' } },
        client: { type: 'object', properties: { name: { type: 'string' }, language: { type: 'string' } } },
        stage, launchTarget: { type: ['string', 'null'] }, sessionId: { type: ['string', 'null'] },
        pr: { type: ['object', 'null'], properties: { number: { type: 'integer' }, url: { type: 'string' }, state: { type: 'string' }, labels: { type: 'array', items: { type: 'string' } } } },
        proposalUrl: { type: ['string', 'null'] }, evidenceUrl: { type: ['string', 'null'] },
        approvals: { type: 'object', additionalProperties: approval },
        questions: { type: 'object', properties: { beforeBuild: { type: 'integer', minimum: 0 }, beforeLaunch: { type: 'integer', minimum: 0 } } },
        build: { type: ['object', 'null'], properties: { stage: { type: 'string' }, headSha: { type: 'string' }, at: { type: 'string' } } },
        ppc: { type: ['object', 'null'] },
        updatedAt: { type: 'string', pattern: ISO },
      },
    },
    sites: {
      type: 'object', required: ['slug', 'brand', 'type', 'stage', 'updatedAt'],
      properties: {
        slug: { type: 'string', pattern: SLUG }, brand: { type: 'string', minLength: 1 }, domain: { type: ['string', 'null'] },
        type: { type: 'string', enum: ['social-casino', 'online-games', 'hotel-casino'] }, variant: { type: ['string', 'null'] },
        locales: { type: 'array', items: { type: 'string' } }, status: { type: ['string', 'null'] }, stage,
        engine: { type: 'string', enum: ['factory', 'none'] }, cfProject: { type: ['string', 'null'] },
        deployed: { type: ['object', 'null'] }, ci: { type: ['object', 'null'] },
        reports: { type: 'object' }, health: { type: ['object', 'null'] }, nearestSibling: { type: ['string', 'null'] },
        incidents: { type: 'integer', minimum: 0 }, updatedAt: { type: 'string', pattern: ISO },
      },
    },
    events: {
      type: 'object', required: ['at', 'kind', 'severity', 'text'],
      properties: { at: { type: 'string', pattern: ISO }, slug: { type: ['string', 'null'] }, kind: { type: 'string', enum: EVENT_KINDS }, severity: { type: 'string', enum: SEVERITIES }, text: { type: 'string', minLength: 1, maxLength: 500 }, ref: { type: ['string', 'null'] } },
    },
    runs: { type: 'object', required: ['slug', 'sha', 'result', 'at'], properties: { slug: { type: 'string', pattern: SLUG }, sha: { type: 'string' }, result: { type: 'string' }, at: { type: 'string', pattern: ISO } } },
    sessions: { type: 'object', required: ['id', 'status'], properties: { id: { type: 'string' }, slug: { type: ['string', 'null'] }, status: { type: 'string' }, lastCheck: { type: ['string', 'null'] } } },
  };
}

/** Find the schema of a collection in G's board.schema.json (several layouts tolerated). */
function boardCollectionSchema(board, c) {
  const singular = c.replace(/s$/, '');
  const cands = [
    board.collections && board.collections[c], board.collections && board.collections[c] && board.collections[c].schema,
    board.collections && board.collections[c] && board.collections[c].doc,
    board.$defs && board.$defs[c], board.$defs && board.$defs[singular], board.$defs && board.$defs[`${singular}Doc`],
    board.properties && board.properties.collections && board.properties.collections.properties && board.properties.collections.properties[c],
    board.properties && board.properties[c],
  ];
  for (const s of cands) if (s && typeof s === 'object' && (s.type || s.properties || s.$ref || s.allOf)) return s;
  return null;
}

function inferCollection(doc) {
  if (doc.orderId) return 'orders';
  if (doc.kind && doc.severity) return 'events';
  if (doc.slug && doc.brand) return 'sites';
  if (doc.sha && doc.result) return 'runs';
  return null;
}

export function validateDoc(doc, collection, root = repoRoot()) {
  const stages = loadStages(root);
  const boardFile = path.join(root, 'schemas', 'board.schema.json');
  const errors = [];
  let source = 'built-in';
  let schema = null; let set = null; let entry = null;
  if (exists(boardFile)) {
    set = new SchemaSet(); entry = set.load(boardFile);
    schema = boardCollectionSchema(entry.schema, collection);
    if (schema) source = 'schemas/board.schema.json';
  }
  if (!schema) { schema = builtin(stages)[collection]; set = null; entry = null; }
  if (!schema) return { ok: false, source, errors: [{ path: '', message: `unknown collection ${collection}` }] };
  errors.push(...validate(doc, schema, set ? { set, entry } : {}).map((e) => ({ path: e.path, message: e.message })));
  // freshness and reference rules (ECC A-97)
  if (doc.stage !== undefined && doc.stage !== null && !stages.stages.includes(doc.stage)) errors.push({ path: 'stage', message: `"${doc.stage}" is not a stage of schemas/stages.json` });
  for (const k of ['updatedAt', 'at', 'lastCheck']) if (typeof doc[k] === 'string' && Number.isNaN(Date.parse(doc[k]))) errors.push({ path: k, message: 'is not a parseable timestamp' });
  if (typeof doc.updatedAt === 'string' && Date.parse(doc.updatedAt) > Date.now() + 5 * 60 * 1000) errors.push({ path: 'updatedAt', message: 'is in the future' });
  return { ok: errors.length === 0, source, errors };
}

function reportsSummary(slug, root) {
  const r = (n) => readJsonIf(path.join(root, 'reports', slug, n));
  const build = r('build.json'); const check = r('check.json'); const uniq = r('uniqueness.json'); const lh = r('lighthouse/summary.json');
  const out = { at: null };
  if (build) { out.buildVersion = build.version || null; out.lint = { problems: (build.problems || []).length, warnings: (build.warnings || []).length }; if (build.policies) out.policy = { unverified: build.policies.unverified, promoted: build.policies.verified }; }
  if (check) { out.check = { passed: check.totals && check.totals.passed, failed: check.totals && check.totals.failed, sections: (check.sections || []).length }; out.axe = (check.axe || []).length; }
  if (uniq) out.uniqueness = { nearest: uniq.nearest || [], max: Math.max(0, ...Object.values((uniq.scores && uniq.scores.site) || {}).filter((x) => typeof x === 'number')), passed: !!uniq.passed };
  if (lh && Array.isArray(lh)) { const by = (p) => lh.filter((u) => u.preset === p); out.lighthouse = { mobile: by('mobile')[0] || null, desktop: by('desktop')[0] || null }; }
  const times = [build, check, uniq].filter(Boolean).map((x) => x.at || x.startedAt).filter(Boolean);
  out.at = times.sort().pop() || null;
  return out;
}

export async function buildRow(collection, id, root = repoRoot()) {
  const now = new Date().toISOString();
  const { rows, stages } = portfolio(root);
  const r = rows.find((x) => x.slug === id);
  if (collection === 'orders') {
    const ordRec = r && r.order;
    if (!ordRec) throw new Error(`no order for ${id} (orders/${id}/order.json or origin/site/${id})`);
    const o = ordRec.order;
    const items = await approvalItemsFor(o.type, root);
    const approvals = {};
    for (const it of items) { const a = (o.approvals || []).find((x) => x.item === it); approvals[it] = a ? a.status : 'pending'; }
    const stage = r.stage || Object.keys(stages.derive.orderStatus).find((s) => stages.derive.orderStatus[s] === o.status) || 'intake';
    const doc = {
      orderId: o.orderId, slug: o.orderId, brand: o.brand && o.brand.name, domain: o.domain, type: o.type, variant: o.variant,
      ...(o.casinoMode ? { casinoMode: o.casinoMode } : {}), ...(o.audience ? { audience: o.audience } : {}), markets: o.markets || [],
      client: { name: o.client && o.client.name, language: o.client && o.client.language },
      stage, launchTarget: (o.dates && o.dates.launchTarget) || null, sessionId: null, pr: null, proposalUrl: null,
      evidenceUrl: (o.launch && o.launch.evidenceUrl) || null, approvals,
      questions: { beforeBuild: 0, beforeLaunch: 0 },
      build: o.build && o.build.stages && o.build.stages.length ? o.build.stages[o.build.stages.length - 1] : null,
      ppc: o.ppc ? { accountId: o.ppc.accountId || null, certification: o.ppc.certification || null, kitVersion: o.ppc.kitVersion || null } : null,
      updatedAt: now,
    };
    const prev = r.boardRow;
    if (prev) for (const k of ['sessionId', 'pr', 'proposalUrl', 'questions']) if (prev[k] !== undefined && prev[k] !== null) doc[k] = prev[k];
    return doc;
  }
  if (collection === 'sites') {
    if (!r || (!r.site && !r.registry)) throw new Error(`no site ${id} (sites/${id}/ or registry entry)`);
    const cfg = (r.site && r.site.config) || {};
    const fp = r.site ? lightFingerprint(r.site, root) : {};
    const stage = r.stage || (r.registry && r.registry.stage) || (fp.sources && fp.sources.includes('seed') ? 'live' : 'building');
    const reports = reportsSummary(id, root);
    return {
      slug: id, brand: cfg.brand || (r.registry && r.registry.brand) || fp.brand || id, domain: cfg.domain || (r.registry && r.registry.domain) || null,
      type: r.type || cfg.type || 'social-casino', variant: cfg.variant || (r.registry && r.registry.variant) || fp.variant || null,
      locales: (cfg.locales || []).map((l) => l.code).filter(Boolean).length ? cfg.locales.map((l) => l.code) : ['en-GB'],
      status: stages.derive.registryStatus[stage] ?? null, stage, engine: r.engine || 'factory',
      cfProject: (cfg.deploy && cfg.deploy.project) || (r.registry && r.registry.cfProject) || null,
      deployed: null, ci: null, reports, health: null,
      nearestSibling: reports.uniqueness && reports.uniqueness.nearest.length ? reports.uniqueness.nearest[0] : null,
      incidents: 0, updatedAt: now,
    };
  }
  throw new UsageError(`row supports the collections orders and sites (got ${collection})`);
}

function readDocs(file) {
  const txt = fs.readFileSync(file, 'utf8').trim();
  if (txt.startsWith('[')) return JSON.parse(txt);
  if (txt.startsWith('{') && !txt.includes('\n{')) return [JSON.parse(txt)];
  return txt.split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
}
const unwrap = (x) => (x && x.data && x.collection ? { collection: x.collection, id: x.id || x.doc_id, doc: x.data } : { collection: null, id: null, doc: x });

async function main(argv) {
  const a = parseArgs(argv, { booleans: ['envelope', 'help', 'json'], strings: ['out', 'collection', 'slug', 'kind', 'severity', 'text', 'ref'] });
  if (a.help || !a._.length) { process.stdout.write(HELP); return a.help ? 0 : 2; }
  const root = repoRoot();
  const [cmd, ...rest] = a._;
  if (cmd === 'row') {
    let collection; let id;
    if (rest.length === 2) [collection, id] = rest;
    else if (rest.length === 1) { id = rest[0]; collection = exists(path.join(root, 'orders', id, 'order.json')) ? 'orders' : 'sites'; }
    else throw new UsageError('row needs <slug> or <collection> <id>');
    const doc = await buildRow(collection, id, root);
    const v = validateDoc(doc, collection, root);
    if (!v.ok) { for (const e of v.errors) process.stderr.write(`board: ${collection}/${id} ${e.path || '(root)'}: ${e.message}\n`); }
    const out = a.envelope ? { collection, id, data: doc } : doc;
    if (a.out) writeJson(path.resolve(a.out), out);
    process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
    return v.ok ? 0 : 1;
  }
  if (cmd === 'validate') {
    if (rest.length !== 1) throw new UsageError('validate needs one file');
    if (!exists(rest[0])) throw new UsageError(`${rest[0]}: no such file`);
    const { collection: envC, id, doc } = unwrap(readJson(rest[0]));
    const collection = a.collection || envC || inferCollection(doc);
    if (!collection) throw new UsageError('cannot infer the collection; pass --collection');
    const v = validateDoc(doc, collection, root);
    for (const e of v.errors) process.stdout.write(`error: ${collection}/${id || doc.slug || doc.orderId || '?'} ${e.path || '(root)'}: ${e.message}\n`);
    process.stdout.write(`board validate: ${rest[0]} as ${collection} (${v.source}): ${v.ok ? 'ok' : `${v.errors.length} error(s)`}\n`);
    return v.ok ? 0 : 1;
  }
  if (cmd === 'batch') {
    if (rest.length !== 1) throw new UsageError('batch needs one file');
    const writes = []; let bad = 0;
    for (const raw of readDocs(rest[0])) {
      const { collection, id, doc } = unwrap(raw);
      const c = collection || inferCollection(doc);
      const docId = id || doc.orderId || doc.slug || doc.id;
      const v = c ? validateDoc(doc, c, root) : { ok: false, errors: [{ path: '', message: 'unknown collection' }] };
      if (!v.ok) { bad++; for (const e of v.errors) process.stderr.write(`board: ${c}/${docId} ${e.path || '(root)'}: ${e.message}\n`); continue; }
      writes.push({ op: 'set', collection: c, doc_id: docId, data: doc });
    }
    process.stdout.write(`${JSON.stringify({ writes }, null, 2)}\n`);
    return bad ? 1 : 0;
  }
  if (cmd === 'event') {
    const doc = { at: new Date().toISOString(), slug: a.slug || null, kind: a.kind, severity: a.severity || 'info', text: a.text, ref: a.ref || null };
    const v = validateDoc(doc, 'events', root);
    if (!v.ok) { for (const e of v.errors) process.stderr.write(`board: event ${e.path}: ${e.message}\n`); return 1; }
    const ulid = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e8).toString(36)}`;
    process.stdout.write(`${JSON.stringify({ collection: 'events', id: ulid, data: doc }, null, 2)}\n`);
    return 0;
  }
  throw new UsageError(`unknown command ${cmd}`);
}

if (isMain(import.meta.url)) runMain(main, HELP);
