// A zero-dependency JSON Schema (draft 2020-12) validator for the subset the
// factory schemas use. The engine validates with Ajv 8 (D-05); the factory
// tools stay dependency-free so they run in any checkout, so this file is
// deliberately small and strict about what it does not support.
//
// Supported: type (incl. integer, type arrays), enum, const, required,
// properties, patternProperties, additionalProperties (boolean or schema),
// propertyNames, dependentRequired, items (schema), prefixItems, minItems,
// maxItems, uniqueItems, contains (+minContains/maxContains), minLength,
// maxLength, pattern, minimum, maximum, exclusiveMinimum, exclusiveMaximum,
// multipleOf, minProperties, maxProperties, format (date, date-time, email,
// uri: light checks), allOf, anyOf, oneOf, not, if/then/else, $ref (local
// "#/..." pointers, "$defs" names, and relative file refs such as
// "stages.json#/$defs/orderStatus" resolved next to the referring schema),
// $id, $schema, $defs, title, description, default, examples, $comment
// (annotations are ignored). Unknown keywords are ignored and listed by
// unknownKeywords() so a test can assert nothing slipped through.
//
// Errors: [{ path, keyword, message, schemaPath }], path in dotted form with
// [i] for array indices ("typeOptions.games.house[1].name"); "" is the root.

import fs from 'node:fs';
import path from 'node:path';

const KNOWN = new Set([
  'type', 'enum', 'const', 'required', 'properties', 'patternProperties', 'additionalProperties',
  'propertyNames', 'dependentRequired', 'items', 'prefixItems', 'minItems', 'maxItems', 'uniqueItems',
  'contains', 'minContains', 'maxContains', 'minLength', 'maxLength', 'pattern', 'minimum', 'maximum',
  'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf', 'minProperties', 'maxProperties', 'format',
  'allOf', 'anyOf', 'oneOf', 'not', 'if', 'then', 'else', '$ref', '$id', '$schema', '$defs',
  'definitions', 'title', 'description', 'default', 'examples', '$comment', 'deprecated', 'readOnly',
  'writeOnly', 'x-question', 'x-level',
]);

const typeOf = (v) => {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v;
};
const typeMatches = (v, t) => {
  const actual = typeOf(v);
  if (t === 'number') return actual === 'number' || actual === 'integer';
  return actual === t;
};
const deepEqual = (a, b) => {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  if (typeof a === 'object') {
    const ka = Object.keys(a); const kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k) => deepEqual(a[k], b[k]));
  }
  return false;
};
const join = (base, key) => (typeof key === 'number' ? `${base}[${key}]` : base ? `${base}.${key}` : String(key));
const show = (v) => { const s = JSON.stringify(v); return s && s.length > 60 ? `${s.slice(0, 57)}...` : s; };

const FORMATS = {
  date: (s) => /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(s),
  'date-time': (s) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(s),
  email: (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s),
  uri: (s) => /^[a-z][a-z0-9+.-]*:[^\s]*$/i.test(s),
};

/** A schema registry: files load lazily and are cached by absolute path and $id. */
export class SchemaSet {
  constructor() { this.byPath = new Map(); this.byId = new Map(); }
  add(schema, file) {
    const entry = { schema, file: file ? path.resolve(file) : null };
    if (entry.file) this.byPath.set(entry.file, entry);
    if (schema && schema.$id) this.byId.set(schema.$id.replace(/#$/, ''), entry);
    return entry;
  }
  load(file) {
    const abs = path.resolve(file);
    if (this.byPath.has(abs)) return this.byPath.get(abs);
    const schema = JSON.parse(fs.readFileSync(abs, 'utf8'));
    return this.add(schema, abs);
  }
  /** Resolve a $ref from the document `entry`. Returns { schema, entry }. */
  resolve(ref, entry) {
    const hash = ref.indexOf('#');
    const docPart = hash >= 0 ? ref.slice(0, hash) : ref;
    const frag = hash >= 0 ? ref.slice(hash + 1) : '';
    let doc = entry;
    if (docPart) {
      if (this.byId.has(docPart)) doc = this.byId.get(docPart);
      else if (/^[a-z]+:/i.test(docPart)) {
        // absolute $id: try the sibling file with the same basename
        const base = docPart.split('/').pop();
        const sib = entry.file ? path.join(path.dirname(entry.file), base) : null;
        if (sib && fs.existsSync(sib)) doc = this.load(sib);
        else throw new Error(`cannot resolve $ref ${ref}`);
      } else {
        const baseDir = entry.file ? path.dirname(entry.file) : process.cwd();
        const target = path.resolve(baseDir, docPart);
        if (!fs.existsSync(target)) throw new Error(`cannot resolve $ref ${ref} (no file ${target})`);
        doc = this.load(target);
      }
    }
    let node = doc.schema;
    if (frag) {
      if (!frag.startsWith('/')) {
        // plain-name anchor: look in $defs
        node = node.$defs && node.$defs[frag];
      } else {
        for (const raw of frag.slice(1).split('/')) {
          const key = decodeURIComponent(raw).replace(/~1/g, '/').replace(/~0/g, '~');
          node = node == null ? undefined : node[key];
        }
      }
    }
    if (node === undefined) throw new Error(`cannot resolve $ref ${ref}`);
    return { schema: node, entry: doc };
  }
}

/** Validate `data` against `schema`. Options: { set, file, entry }. */
export function validate(data, schema, opts = {}) {
  const set = opts.set || new SchemaSet();
  const entry = opts.entry || set.add(schema, opts.file || null);
  const errors = [];
  check(data, schema, '', '#', entry, set, errors);
  return errors;
}

/** Load a schema file and validate data against it. */
export function validateFile(data, schemaFile, set = new SchemaSet()) {
  const entry = set.load(schemaFile);
  const errors = [];
  check(data, entry.schema, '', '#', entry, set, errors);
  return errors;
}

function check(v, s, p, sp, entry, set, errors) {
  if (s === true || s === undefined) return;
  if (s === false) { errors.push({ path: p, keyword: 'false', message: 'is not allowed here', schemaPath: sp }); return; }
  if (typeof s !== 'object' || s === null) return;
  if (s.$id && s !== entry.schema) {
    const e2 = set.byId.get(s.$id.replace(/#$/, ''));
    if (e2) entry = e2;
  }
  const err = (keyword, message, extra = {}) => errors.push({ path: p, keyword, message, schemaPath: `${sp}/${keyword}`, ...extra });

  if (s.$ref) {
    const r = set.resolve(s.$ref, entry);
    check(v, r.schema, p, `${sp}/$ref`, r.entry, set, errors);
  }
  if (s.type !== undefined) {
    const types = Array.isArray(s.type) ? s.type : [s.type];
    if (!types.some((t) => typeMatches(v, t))) { err('type', `must be ${types.join(' or ')} (got ${typeOf(v)})`); return; }
  }
  if (s.const !== undefined && !deepEqual(v, s.const)) err('const', `must be ${show(s.const)} (got ${show(v)})`);
  if (s.enum && !s.enum.some((e) => deepEqual(e, v))) err('enum', `must be one of ${s.enum.map(show).join(', ')} (got ${show(v)})`);

  const t = typeOf(v);
  if (t === 'string') {
    const len = [...v].length;
    if (s.minLength !== undefined && len < s.minLength) err('minLength', `must be at least ${s.minLength} characters`);
    if (s.maxLength !== undefined && len > s.maxLength) err('maxLength', `must be at most ${s.maxLength} characters`);
    if (s.pattern !== undefined && !new RegExp(s.pattern, 'u').test(v)) err('pattern', `must match ${s.pattern} (got ${show(v)})`);
    if (s.format && FORMATS[s.format] && !FORMATS[s.format](v)) err('format', `must be a valid ${s.format} (got ${show(v)})`);
  }
  if (t === 'number' || t === 'integer') {
    if (s.minimum !== undefined && v < s.minimum) err('minimum', `must be >= ${s.minimum}`);
    if (s.maximum !== undefined && v > s.maximum) err('maximum', `must be <= ${s.maximum}`);
    if (s.exclusiveMinimum !== undefined && v <= s.exclusiveMinimum) err('exclusiveMinimum', `must be > ${s.exclusiveMinimum}`);
    if (s.exclusiveMaximum !== undefined && v >= s.exclusiveMaximum) err('exclusiveMaximum', `must be < ${s.exclusiveMaximum}`);
    if (s.multipleOf !== undefined && Math.abs(v / s.multipleOf - Math.round(v / s.multipleOf)) > 1e-9) err('multipleOf', `must be a multiple of ${s.multipleOf}`);
  }
  if (t === 'array') {
    if (s.minItems !== undefined && v.length < s.minItems) err('minItems', `must have at least ${s.minItems} items (has ${v.length})`);
    if (s.maxItems !== undefined && v.length > s.maxItems) err('maxItems', `must have at most ${s.maxItems} items (has ${v.length})`);
    if (s.uniqueItems) {
      for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) {
        if (deepEqual(v[i], v[j])) { err('uniqueItems', `items ${i} and ${j} are identical`); i = v.length; break; }
      }
    }
    const prefix = s.prefixItems || [];
    prefix.forEach((ps, i) => { if (i < v.length) check(v[i], ps, join(p, i), `${sp}/prefixItems/${i}`, entry, set, errors); });
    if (s.items !== undefined) for (let i = prefix.length; i < v.length; i++) check(v[i], s.items, join(p, i), `${sp}/items`, entry, set, errors);
    if (s.contains !== undefined) {
      const n = v.filter((x) => { const e = []; check(x, s.contains, p, sp, entry, set, e); return e.length === 0; }).length;
      const min = s.minContains ?? 1;
      if (n < min) err('contains', `must contain at least ${min} matching item(s)`);
      if (s.maxContains !== undefined && n > s.maxContains) err('contains', `must contain at most ${s.maxContains} matching item(s)`);
    }
  }
  if (t === 'object') {
    const keys = Object.keys(v);
    if (s.required) for (const k of s.required) if (!(k in v)) errors.push({ path: join(p, k), keyword: 'required', message: 'is required', schemaPath: `${sp}/required`, missing: k });
    if (s.minProperties !== undefined && keys.length < s.minProperties) err('minProperties', `must have at least ${s.minProperties} properties`);
    if (s.maxProperties !== undefined && keys.length > s.maxProperties) err('maxProperties', `must have at most ${s.maxProperties} properties`);
    if (s.dependentRequired) for (const [k, deps] of Object.entries(s.dependentRequired)) if (k in v) for (const d of deps) if (!(d in v)) errors.push({ path: join(p, d), keyword: 'dependentRequired', message: `is required when ${k} is present`, schemaPath: `${sp}/dependentRequired` });
    if (s.propertyNames) for (const k of keys) check(k, s.propertyNames, join(p, k), `${sp}/propertyNames`, entry, set, errors);
    const props = s.properties || {};
    const pats = s.patternProperties ? Object.entries(s.patternProperties).map(([re, ps]) => [new RegExp(re, 'u'), ps]) : [];
    for (const k of keys) {
      let matched = false;
      if (Object.prototype.hasOwnProperty.call(props, k)) { matched = true; check(v[k], props[k], join(p, k), `${sp}/properties/${k}`, entry, set, errors); }
      for (const [re, ps] of pats) if (re.test(k)) { matched = true; check(v[k], ps, join(p, k), `${sp}/patternProperties`, entry, set, errors); }
      if (!matched && s.additionalProperties !== undefined) {
        if (s.additionalProperties === false) errors.push({ path: join(p, k), keyword: 'additionalProperties', message: 'is not an allowed property', schemaPath: `${sp}/additionalProperties` });
        else check(v[k], s.additionalProperties, join(p, k), `${sp}/additionalProperties`, entry, set, errors);
      }
    }
  }
  if (s.allOf) s.allOf.forEach((sub, i) => check(v, sub, p, `${sp}/allOf/${i}`, entry, set, errors));
  if (s.anyOf) {
    const branches = s.anyOf.map((sub, i) => { const e = []; check(v, sub, p, `${sp}/anyOf/${i}`, entry, set, e); return e; });
    if (!branches.some((e) => e.length === 0)) {
      const best = branches.reduce((a, b) => (b.length < a.length ? b : a));
      err('anyOf', `must match at least one alternative (closest: ${best.map((e) => `${e.path || '(root)'} ${e.message}`).slice(0, 2).join('; ')})`);
    }
  }
  if (s.oneOf) {
    const branches = s.oneOf.map((sub, i) => { const e = []; check(v, sub, p, `${sp}/oneOf/${i}`, entry, set, e); return e; });
    const ok = branches.filter((e) => e.length === 0).length;
    if (ok !== 1) {
      const best = branches.reduce((a, b) => (b.length < a.length ? b : a));
      err('oneOf', ok === 0 ? `must match exactly one alternative (closest: ${best.map((e) => `${e.path || '(root)'} ${e.message}`).slice(0, 2).join('; ')})` : `matches ${ok} alternatives, expected exactly one`);
    }
  }
  if (s.not !== undefined) {
    const e = []; check(v, s.not, p, `${sp}/not`, entry, set, e);
    if (e.length === 0) err('not', `must not match ${s.not.$comment || show(s.not)}`);
  }
  if (s.if !== undefined) {
    const e = []; check(v, s.if, p, `${sp}/if`, entry, set, e);
    if (e.length === 0) { if (s.then !== undefined) check(v, s.then, p, `${sp}/then`, entry, set, errors); }
    else if (s.else !== undefined) check(v, s.else, p, `${sp}/else`, entry, set, errors);
  }
}

/** Keywords in a schema tree that this validator does not implement. */
export function unknownKeywords(schema) {
  const found = new Set();
  const rec = (s, inMap) => {
    if (Array.isArray(s)) { s.forEach((x) => rec(x, false)); return; }
    if (!s || typeof s !== 'object') return;
    for (const [k, v] of Object.entries(s)) {
      if (inMap) { rec(v, false); continue; }
      if (!KNOWN.has(k)) found.add(k);
      if (['properties', 'patternProperties', '$defs', 'definitions', 'dependentRequired'].includes(k)) rec(v, true);
      else if (!['enum', 'const', 'default', 'examples', 'required'].includes(k)) rec(v, false);
    }
  };
  rec(schema, false);
  return [...found].sort();
}

/** Check that a document looks like a draft 2020-12 schema this validator can compile. */
export function lintSchema(schema) {
  const problems = [];
  if (!schema || typeof schema !== 'object') return ['not an object'];
  if (schema.$schema && !/2020-12/.test(schema.$schema)) problems.push(`$schema is ${schema.$schema}, expected draft 2020-12`);
  const rec = (s, at) => {
    if (Array.isArray(s)) { s.forEach((x, i) => rec(x, `${at}/${i}`)); return; }
    if (!s || typeof s !== 'object') return;
    if (s.type !== undefined) {
      const ok = ['string', 'number', 'integer', 'boolean', 'object', 'array', 'null'];
      for (const t of [].concat(s.type)) if (!ok.includes(t)) problems.push(`${at}: unknown type ${t}`);
    }
    if (s.pattern !== undefined) { try { new RegExp(s.pattern, 'u'); } catch (e) { problems.push(`${at}: bad pattern ${s.pattern} (${e.message})`); } }
    if (s.required !== undefined && !Array.isArray(s.required)) problems.push(`${at}: required must be an array`);
    for (const [k, v] of Object.entries(s)) {
      if (['properties', 'patternProperties', '$defs', 'definitions'].includes(k) && v && typeof v === 'object') for (const [n, sub] of Object.entries(v)) rec(sub, `${at}/${k}/${n}`);
      else if (['items', 'not', 'if', 'then', 'else', 'contains', 'additionalProperties', 'propertyNames'].includes(k)) rec(v, `${at}/${k}`);
      else if (['allOf', 'anyOf', 'oneOf', 'prefixItems'].includes(k)) rec(v, `${at}/${k}`);
    }
  };
  rec(schema, '#');
  return problems;
}
