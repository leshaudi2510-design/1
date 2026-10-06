#!/usr/bin/env node
// Derive sites/<slug>/site.config.json and concept.json from orders/<slug>/order.json (SPEC 10.4, MASTER-PLAN 4.2).

import path from 'node:path';
import { parseArgs, runMain, UsageError, repoRoot, readJsonIf, writeJson, isMain } from './lib/common.mjs';
import { loadOrder } from './lib/order.mjs';
import { orderToConfig, orderToConcept, mergePreserving, diffDerived } from './lib/config.mjs';

const HELP = `Usage: node tools/order-to-config.mjs <orderDir|order.json> [--print] [--print-concept] [--check] [--v2] [--site DIR]

Derives the site configuration from an order. The derived file is never hand
edited (lint config-derived), except games[].skin / games[].rtp (and
typeOptions.games[].skin|rtp in v2), which are preserved from the existing file;
keys the order does not produce (for example engine-only keys of a template)
are kept as they are.

  (default)        write <site>/site.config.json and <site>/concept.json
  --print          print the derived site.config.json to stdout, write nothing
  --print-concept  print the derived concept.json to stdout, write nothing
  --check          exit 1 when the committed site.config.json differs from the
                   derived one (prints the differing keys); writes nothing
  --v2             emit the v2 shape (schemaVersion 2, locales, geo, operator,
                   thirdParties, typeOptions; MASTER-PLAN 4.2). Default is v1:
                   today's keys + type + storagePrefix (D-48, Phase 1)
  --site DIR       site directory (default sites/<orderId>)
  --help           this text

storagePrefix: kept from the existing config, else the slug's initials
(meridian-signal-rooms -> msr), unique among sites/*. concept.json siblings are
the same-type sites on disk (registry branch from Phase 2).
`;

async function main(argv) {
  const a = parseArgs(argv, { booleans: ['print', 'print-concept', 'check', 'v2', 'help'], strings: ['site'] });
  if (a.help) { process.stdout.write(HELP); return 0; }
  if (a._.length !== 1) throw new UsageError('give one order directory or order.json');
  const root = repoRoot();
  const { order } = loadOrder(a._[0]);
  if (!order.orderId) throw new UsageError('the order has no orderId');
  const siteDir = a.site ? path.resolve(a.site) : path.join(root, 'sites', order.orderId);
  const cfgFile = path.join(siteDir, 'site.config.json');
  const existing = readJsonIf(cfgFile);
  const derived = orderToConfig(order, { version: a.v2 ? 2 : 1, root, storagePrefix: existing && existing.storagePrefix });
  if (a.print) { process.stdout.write(`${JSON.stringify(derived, null, 2)}\n`); return 0; }
  if (a['print-concept']) { process.stdout.write(`${JSON.stringify(orderToConcept(order, { root }), null, 2)}\n`); return 0; }
  if (a.check) {
    if (!existing) { process.stdout.write(`order-to-config: ${path.relative(root, cfgFile)} does not exist\n`); return 1; }
    const diff = diffDerived(derived, existing);
    if (diff.length) { process.stdout.write(`order-to-config: ${path.relative(root, cfgFile)} differs from the order in: ${diff.join(', ')}\n`); return 1; }
    process.stdout.write(`order-to-config: ${path.relative(root, cfgFile)} matches the order\n`);
    return 0;
  }
  writeJson(cfgFile, mergePreserving(derived, existing));
  writeJson(path.join(siteDir, 'concept.json'), orderToConcept(order, { root }));
  process.stdout.write(`order-to-config: wrote ${path.relative(root, cfgFile)} and concept.json\n`);
  return 0;
}

if (isMain(import.meta.url)) runMain(main, HELP);
