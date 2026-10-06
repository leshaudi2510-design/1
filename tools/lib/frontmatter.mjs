// YAML front matter for agents, skills and routines. Uses the `yaml` package when it is
// installed (root devDependency from Phase 1, F), else a small parser for the subset these
// files use: scalars, quoted strings, inline [a, b] lists, "- item" lists, one level of
// nested maps, and | / > block scalars.

let yamlLib = null;
try { yamlLib = (await import('yaml')).default; } catch { yamlLib = null; }

export function splitFrontMatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return null;
  return { raw: m[1], body: m[2] };
}

const scalar = (s) => {
  const t = s.trim();
  if (t === '') return null;
  if (/^".*"$/.test(t)) return JSON.parse(t);
  if (/^'.*'$/.test(t)) return t.slice(1, -1).replace(/''/g, "'");
  if (/^\[.*\]$/.test(t)) return splitInline(t.slice(1, -1)).map(scalar);
  if (/^\{.*\}$/.test(t)) return Object.fromEntries(splitInline(t.slice(1, -1)).map((kv) => { const i = kv.indexOf(':'); return [kv.slice(0, i).trim(), scalar(kv.slice(i + 1))]; }));
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t === 'null' || t === '~') return null;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return t.replace(/\s+#.*$/, '');
};
function splitInline(s) {
  const out = []; let depth = 0; let cur = ''; let q = null;
  for (const c of s) {
    if (q) { cur += c; if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    if (c === '[' || c === '{') depth++;
    if (c === ']' || c === '}') depth--;
    if (c === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export function parseYamlSubset(src) {
  const lines = src.split(/\r?\n/);
  const root = {};
  let i = 0;
  const indentOf = (l) => l.match(/^ */)[0].length;
  function block(minIndent, style) {
    const out = [];
    while (i < lines.length && (lines[i].trim() === '' || indentOf(lines[i]) >= minIndent)) { out.push(lines[i].slice(minIndent)); i++; }
    while (out.length && out[out.length - 1].trim() === '') out.pop();
    return style === '>' ? out.join(' ').replace(/\s+/g, ' ').trim() : `${out.join('\n')}\n`;
  }
  function map(indent) {
    const obj = {};
    while (i < lines.length) {
      const line = lines[i];
      if (line.trim() === '' || /^\s*#/.test(line)) { i++; continue; }
      const ind = indentOf(line);
      if (ind < indent) break;
      if (ind > indent) throw new Error(`unexpected indentation at line ${i + 1}: ${line}`);
      const m = line.slice(ind).match(/^([^:#][^:]*?):(?:\s+(.*)|\s*)$/);
      if (!m) throw new Error(`cannot parse line ${i + 1}: ${line}`);
      const key = m[1].trim(); const rest = m[2] === undefined ? '' : m[2];
      i++;
      if (/^[|>][+-]?$/.test(rest.trim())) { obj[key] = block(indent + 2, rest.trim()[0]); continue; }
      if (rest.trim() !== '') { obj[key] = scalar(rest); continue; }
      // nested list or map
      let j = i; while (j < lines.length && lines[j].trim() === '') j++;
      if (j >= lines.length || indentOf(lines[j]) <= indent) { obj[key] = null; continue; }
      const childIndent = indentOf(lines[j]);
      if (lines[j].slice(childIndent).startsWith('- ') || lines[j].trim() === '-') {
        const arr = [];
        while (i < lines.length) {
          const l = lines[i];
          if (l.trim() === '') { i++; continue; }
          if (indentOf(l) < childIndent || !l.slice(childIndent).startsWith('-')) break;
          arr.push(scalar(l.slice(childIndent + 1)));
          i++;
        }
        obj[key] = arr;
      } else obj[key] = map(childIndent);
    }
    return obj;
  }
  Object.assign(root, map(0));
  return root;
}

export function parseFrontMatter(text) {
  const fm = splitFrontMatter(text);
  if (!fm) return { error: 'no front matter (--- ... --- at the top)' };
  try {
    const data = yamlLib ? yamlLib.parse(fm.raw) : parseYamlSubset(fm.raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return { error: 'front matter is not a map' };
    return { data, body: fm.body, parser: yamlLib ? 'yaml' : 'subset' };
  } catch (e) {
    return { error: `front matter does not parse: ${e.message}` };
  }
}
