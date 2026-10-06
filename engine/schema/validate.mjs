// site.config.json validation against engine/schema/site.config.schema.json.
//
// Ajv 8 (draft 2020-12) does the work when the repository's hoisted
// node_modules has it (D-05: no home-made subset validator). Without it, as in
// an exported site or a checkout before `npm ci`, only the schema's top-level
// "required" list is checked, and the result says so (validator:
// 'required-only'), so a build never claims a validation it didn't do.
//
//   const { validator, errors } = await validateConfig(cfg, { REPO });
//   errors: [{ path, message, missing? }]

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SITE_CONFIG_SCHEMA = path.join(HERE, 'site.config.schema.json');

const compiled = new Map();
function loadAjv(REPO) {
  for (const base of [REPO, HERE]) {
    try {
      const require = createRequire(path.join(base, 'package.json'));
      const mod = require('ajv/dist/2020');
      return mod.default || mod;
    } catch {}
  }
  return null;
}

export async function validateConfig(cfg, { REPO = path.dirname(path.dirname(HERE)), schemaFile = SITE_CONFIG_SCHEMA } = {}) {
  const schema = JSON.parse(readFileSync(schemaFile, 'utf8'));
  const Ajv = loadAjv(REPO);
  if (Ajv) {
    if (!compiled.has(schemaFile)) compiled.set(schemaFile, new Ajv({ allErrors: true, strict: false }).compile(schema));
    const validate = compiled.get(schemaFile);
    const errors = validate(cfg)
      ? []
      : validate.errors.filter((e) => e.keyword !== 'if').map((e) => {
          const at = e.instancePath ? e.instancePath.slice(1).replace(/\//g, '.') : '(top level)';
          const missing = e.keyword === 'required' && !e.instancePath ? e.params.missingProperty : undefined;
          const extra = e.keyword === 'additionalProperties' ? ` ("${e.params.additionalProperty}")` : '';
          return { path: at, message: `${at} ${e.message}${extra}`, missing };
        });
    return { validator: 'ajv', errors };
  }
  const errors = (schema.required || [])
    .filter((k) => !(k in (cfg || {})))
    .map((k) => ({ path: '(top level)', message: `(top level) must have required property '${k}'`, missing: k }));
  return { validator: 'required-only', errors };
}
