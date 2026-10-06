#!/usr/bin/env node
// Validate an order against schemas/order.schema.json (1.2), the type pack's
// order-options overlay and the cross-field rules (SPEC 4.1, ST 1.4, MASTER-PLAN 4.1).

import path from 'node:path';
import { parseArgs, runMain, UsageError, repoRoot, exists, isDir, walk } from './lib/common.mjs';
import { loadOrder, validateOrder } from './lib/order.mjs';

const HELP = `Usage: node tools/validate-order.mjs <orderDir|order.json>... --level draft|build|launch [options]

Validates an order against schemas/order.schema.json (schemaVersion 1.2), then
types/<type>/schema/order-options.schema.json when the type pack ships one
(applied to typeOptions, or to the whole order when it declares typeOptions),
then the cross-field rules that JSON Schema cannot express:

  every level  ST 1.4 rejections (demo lobby with an Ads ID or without the
               provider's written consent, sweepstakes, real-money links,
               hotel Mode B without Google's confirmation / the GB opinion,
               scraped Poki/CrazyGames portals); heroGame is a house slug;
               palette roles unique; topUpBelow < startingBalance; cur FUN;
               demos exist in the Pragmatic catalogue; one default locale;
               audience only from a signed assessment
  draft        missing blocks are listed (with questions), not errors; only
               schemaVersion, orderId, type, status, client, brief and
               brand.name are required
  build        the full schema
  launch       + no placeholders anywhere, ppc.primaryConversion chosen,
               operator registry check (Companies House URL carries the
               number), legal reviewer and date, uniqueness passed, every
               approval item of the type approved, age verification decided,
               launch ticks policyUrlsVerified / audienceAssessmentSigned /
               affiliatePaidSearchChecked / providerPaidSearchChecked,
               dates not in the future, MX for the operator mailbox

Options:
  --level L     draft | build | launch (default build)
  --example     with a directory: validate <dir>/order.example.json
  --examples    with a directory: validate every <dir>/order.example*.json
  --json        print { level, ok, file, type, errors[], warnings[], missing[] }
                (one object per input; an array when there are several)
  --offline     skip the MX lookup at --level launch
  --help        this text

Each error is { path, message, question, rule }; question comes from
orders/_templates/questions.<type>.<lang>.md (field: lines) in the client's
language, ready for questions.md. Exit 0 when every input is valid, 1 when
any is not, 2 on usage errors.
`;

async function main(argv) {
  const a = parseArgs(argv, { booleans: ['json', 'offline', 'example', 'examples', 'help'], strings: ['level'] });
  if (a.help) { process.stdout.write(HELP); return 0; }
  const level = a.level || 'build';
  if (!['draft', 'build', 'launch'].includes(level)) throw new UsageError(`--level must be draft, build or launch (got ${level})`);
  if (!a._.length) throw new UsageError('give at least one order directory or order.json');
  const inputs = [];
  for (const arg of a._) {
    if ((a.example || a.examples) && isDir(arg)) {
      if (a.examples) {
        const files = walk(arg).filter((f) => /^order\.example(\.[a-z-]+)?\.json$/.test(f)).map((f) => path.join(arg, f));
        if (!files.length) throw new UsageError(`${arg}: no order.example*.json files`);
        inputs.push(...files);
      } else {
        const f = path.join(arg, 'order.example.json');
        if (!exists(f)) throw new UsageError(`${arg}: no order.example.json`);
        inputs.push(f);
      }
    } else inputs.push(arg);
  }
  const root = repoRoot();
  const results = [];
  for (const input of inputs) {
    let res;
    try {
      const { file, order } = loadOrder(input);
      const rel = path.relative(process.cwd(), file);
      res = { file: rel && !rel.startsWith('..') ? rel : file, ...(await validateOrder(order, { level, root, offline: a.offline, file })) };
    } catch (e) {
      res = { file: input, level, ok: false, type: null, errors: [{ path: '', message: e.message, question: '', rule: 'input' }], warnings: [], missing: [] };
    }
    results.push(res);
  }
  if (a.json) process.stdout.write(`${JSON.stringify(results.length === 1 ? results[0] : results, null, 2)}\n`);
  else for (const r of results) {
    process.stdout.write(`${r.ok ? 'ok  ' : 'FAIL'} ${r.file} (level ${r.level}, type ${r.type || '?'}${r.overlay ? `, overlay ${r.overlay}` : ''}): ${r.errors.length} error(s), ${r.warnings.length} warning(s)${r.missing.length ? `, ${r.missing.length} missing (questions)` : ''}\n`);
    for (const e of r.errors) process.stdout.write(`  error   ${e.path || '(root)'}: ${e.message} [${e.rule}]\n`);
    for (const w of r.warnings) process.stdout.write(`  warning ${w.path || '(root)'}: ${w.message} [${w.rule}]\n`);
    for (const m of r.missing) process.stdout.write(`  missing ${m.path}: ${m.question}\n`);
  }
  return results.every((r) => r.ok) ? 0 : 1;
}

runMain(main, HELP);
