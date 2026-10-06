// Entry point so that `node --test .claude/hooks/tests` (a directory argument, which Node 22 resolves
// as a module) runs every *.test.mjs file in this folder. `node --test .claude/hooks/tests/*.test.mjs`
// runs the same files one process each.
'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

(async () => {
  const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.mjs')).sort();
  for (const f of files) await import(pathToFileURL(path.join(__dirname, f)).href);
})().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
