import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'index.html'), 'utf8');

test('numeric gaps are filled with demo figures', () => {
  assert.doesNotMatch(html, /class="todo"[^>]*>[^<]*__/);
  assert.match(html, /до&nbsp;<span data-count="2" data-suffix="%">2%<\/span>/);
  assert.match(html, /data-count="80"/);
  assert.match(html, /3&nbsp;000 рабочих мест/);
  assert.match(html, /5&nbsp;000 рабочих мест/);
  assert.match(html, /data-count="75" data-prefix="−" data-suffix="%"/);
  assert.match(html, /На&nbsp;100 устройствах/);
  assert.match(html, /data-count="20" data-suffix="&nbsp;лет"/);
  assert.match(html, /PDF · 4,8&nbsp;МБ/);
});
