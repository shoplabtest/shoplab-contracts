import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';

const specs = readdirSync('openapi').map((f) => [f, parse(readFileSync(`openapi/${f}`, 'utf8'))]);

test('every operation has a globally unique operationId', () => {
  const ids = specs.flatMap(([, s]) => Object.values(s.paths).flatMap((p) => Object.values(p).map((o) => o.operationId)));
  assert.ok(ids.every(Boolean), 'missing operationId');
  assert.equal(new Set(ids).size, ids.length);
});

test('all $refs resolve inside their spec', () => {
  for (const [f, s] of specs) {
    for (const ref of JSON.stringify(s).match(/#\/components\/schemas\/\w+/g) ?? []) {
      assert.ok(s.components.schemas[ref.split('/').pop()], `${f}: dangling ${ref}`);
    }
  }
});

test('event schemas are valid JSON and require their properties', () => {
  for (const f of readdirSync('events')) {
    const s = JSON.parse(readFileSync(`events/${f}`, 'utf8'));
    for (const r of s.required) assert.ok(s.properties[r], `${f}: required ${r} undefined`);
  }
});
