// Generates TypeScript types and a typed client from the OpenAPI specs.
//
//   node ../shoplab-contracts/scripts/generate.mjs --services orders,payments --out src/generated/contracts.ts [--types-only]
//
// `--types-only` leaves out the client, for services that produce these responses instead of calling them.
//
// Types are named after the schemas under `components.schemas`; client methods are named after each operation's
// `operationId`. Consumers commit the generated file and regenerate it when the contracts change.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parse } from 'yaml';

const root = resolve(import.meta.dirname, '..');
const SERVICE_FILES = Object.fromEntries(readdirSync(join(root, 'openapi')).filter((f) => f.endsWith('.yaml')).map((f) => [f.replace('.yaml', ''), f]));

const refName = (ref) => ref.split('/').pop();
const indent = (s, n = 2) => s.split('\n').map((l) => (l ? ' '.repeat(n) + l : l)).join('\n');

/** TypeScript for a JSON-schema fragment. With `inline`, objects are written on one line (for method signatures). */
export function tsType(s, inline = false) {
  if (!s) return 'unknown';
  let t;
  if (s.$ref) t = refName(s.$ref);
  else if (s.allOf) t = s.allOf.map((x) => tsType(x, inline)).join(' & ');
  else if (s.enum) t = s.enum.map((v) => JSON.stringify(v)).join(' | ');
  else if (s.type === 'array') t = `${wrap(tsType(s.items, inline))}[]`;
  else if (s.type === 'object' || s.properties) t = objectType(s, inline);
  else if (s.type === 'integer' || s.type === 'number') t = 'number';
  else if (s.type === 'string') t = 'string';
  else if (s.type === 'boolean') t = 'boolean';
  else t = 'unknown';
  return s.nullable ? `${wrap(t)} | null` : t;
}

const wrap = (t) => (/[ &|]/.test(t) ? `(${t})` : t);

function objectType(s, inline = false) {
  const props = Object.entries(s.properties ?? {});
  if (!props.length) return s.additionalProperties ? 'Record<string, unknown>' : 'Record<string, never>';
  const required = new Set(s.required ?? []);
  const key = (k) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k));
  if (inline) return `{ ${props.map(([k, v]) => `${key(k)}${required.has(k) ? '' : '?'}: ${tsType(v, true)}`).join('; ')} }`;
  const lines = props.map(([k, v]) => `${v.description ? `/** ${v.description} */\n` : ''}${key(k)}${required.has(k) ? '' : '?'}: ${tsType(v)};`);
  return `{\n${indent(lines.join('\n'))}\n}`;
}

function declare(name, s) {
  const doc = s.description ? `/** ${s.description} */\n` : '';
  const isPlainObject = (s.type === 'object' || s.properties) && !s.allOf && !s.nullable;
  return isPlainObject ? `${doc}export interface ${name} ${objectType(s)}` : `${doc}export type ${name} = ${tsType(s)};`;
}

const jsonSchema = (content) => content?.['application/json']?.schema;

function successType(op) {
  const code = Object.keys(op.responses ?? {}).find((c) => c.startsWith('2'));
  if (!code) return 'void';
  const res = op.responses[code];
  if (!res.content) return 'void';
  const schema = jsonSchema(res.content);
  return schema ? tsType(schema, true) : null; // null: not JSON (e.g. a PDF), not part of the client
}

/** One client method for an operation, or null when the operation does not return JSON. */
function method(path, verb, op) {
  const returns = successType(op);
  if (returns === null) return null;
  const params = op.parameters ?? [];
  const pathParams = params.filter((p) => p.in === 'path');
  const query = params.filter((p) => p.in === 'query');
  const args = pathParams.map((p) => `${p.name}: string`);
  const body = op.requestBody && jsonSchema(op.requestBody.content);
  if (body) args.push(`body${op.requestBody.required ? '' : '?'}: ${tsType(body, true)}`);
  if (query.length) {
    const fields = query.map((q) => `${q.name}${q.required ? '' : '?'}: ${tsType(q.schema, true)}`).join('; ');
    args.push(`query${query.some((q) => q.required) ? '' : '?'}: { ${fields} }`);
  }
  args.push('init?: RequestInit');

  const url = '`' + path.replace(/\{(\w+)\}/g, (_, n) => '${encodeURIComponent(' + n + ')}') + '`';
  const target = query.length ? `\`${path.replace(/\{(\w+)\}/g, (_, n) => '${encodeURIComponent(' + n + ')}')}\${qs(query)}\`` : path.includes('{') ? url : `'${path}'`;
  const init = verb === 'get' ? 'init' : `{ ...init, method: '${verb.toUpperCase()}'${body ? ', body: JSON.stringify(body)' : ''} }`;
  const doc = op.description ? `/** ${op.description.replace(/\*\//g, '* /')} */\n` : '';
  return `${doc}${op.operationId}: (${args.join(', ')}) => request<${returns}>(${target}, ${init}),`;
}

/** The generated source for the given services, as one string. Deterministic. */
export function generate(services, { typesOnly = false } = {}) {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const declared = [];
  const methods = [];
  for (const svc of services) {
    const file = SERVICE_FILES[svc];
    if (!file) throw new Error(`unknown service "${svc}"; known: ${Object.keys(SERVICE_FILES).join(', ')}`);
    const spec = parse(readFileSync(join(root, 'openapi', file), 'utf8'));
    for (const [name, schema] of Object.entries(spec.components?.schemas ?? {})) declared.push(declare(name, schema));
    for (const [path, item] of Object.entries(spec.paths)) {
      for (const [verb, op] of Object.entries(item)) {
        const m = method(path, verb, op);
        if (m) methods.push(m);
      }
    }
  }
  const header = `// Generated by shoplab-contracts scripts/generate.mjs (contracts ${pkg.version}; services: ${services.join(', ')}${typesOnly ? '; types only' : ''}). Do not edit: regenerate.`;
  if (typesOnly) return [header, '', declared.join('\n\n'), ''].join('\n');
  return [
    header,
    '',
    declared.join('\n\n'),
    '',
    '/** Performs a request and returns the parsed JSON body; throws on a non-2xx answer. The host\'s `authFetch` fits. */',
    'export type Request = <T>(path: string, init?: RequestInit) => Promise<T>;',
    '',
    "const qs = (query?: object) => {",
    "  const p = new URLSearchParams();",
    "  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined) p.set(k, String(v));",
    "  const s = p.toString();",
    "  return s ? `?${s}` : '';",
    '};',
    '',
    '/** One method per operation, named by its operationId. */',
    'export function createClient(request: Request) {',
    '  return {',
    indent(methods.join('\n'), 4),
    '  };',
    '}',
    '',
    'export type Client = ReturnType<typeof createClient>;',
    '',
  ].join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : undefined; };
  const out = arg('out');
  if (!out) throw new Error('usage: generate.mjs --services a,b --out path/to/contracts.ts');
  const services = (arg('services') ?? Object.keys(SERVICE_FILES).join(',')).split(',');
  mkdirSync(dirname(resolve(out)), { recursive: true });
  writeFileSync(resolve(out), generate(services, { typesOnly: process.argv.includes('--types-only') }));
  console.log(`wrote ${out} (${services.join(', ')})`);
}
