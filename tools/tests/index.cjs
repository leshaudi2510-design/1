// Entry point for `node --test tools/tests`: Node 22 treats a directory argument
// as a module path (resolved through ./package.json "main"), so this file loads
// every *.test.mjs here. `node --test tools/tests/*.test.mjs` works as well.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const files = fs.readdirSync(__dirname).filter((f) => f.endsWith('.test.mjs')).sort();
(async () => {
  for (const f of files) await import(pathToFileURL(path.join(__dirname, f)).href);
})().catch((e) => { console.error(e); process.exitCode = 1; });
