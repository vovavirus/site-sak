import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');

test('AI section is present and titled САКУРА + ИИ', () => {
  assert.match(html, /<section id="ai"/);
  assert.match(html, /САКУРА \+ ИИ/);
  assert.match(html, /Как ИИ меняет рынок и роль САКУРЫ/);
});

test('AI section uses official Cognitum logo and site', () => {
  assert.ok(existsSync(join(root, 'assets/logos/cognitum.svg')));
  assert.match(html, /src="assets\/logos\/cognitum\.svg"/);
  assert.match(html, /href="https:\/\/cognitum\.it-expertise\.ru"/);
});

test('nav points to the AI section on desktop and mobile', () => {
  assert.match(html, /<a[^>]+href="#ai">ИИ<\/a>/);
  assert.equal([...html.matchAll(/href="#ai"/g)].length >= 2, true);
});

test('AI section keeps the four market mechanisms', () => {
  assert.match(html, /Ускорение действий атакующих/);
  assert.match(html, /Рост числа ИИ-инструментов внутри компаний/);
  assert.match(html, /Ускорение работы защитников/);
  assert.match(html, /Бюджет решает, кто покупает/);
});
