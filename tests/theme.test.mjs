import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const match = html.match(/<script id="theme-logic">([\s\S]*?)<\/script>/);
assert.ok(match, 'theme-logic script not found in index.html');

const context = vm.createContext({});
vm.runInContext(match[1], context);
const { THEMES, STORAGE_KEY, DEFAULT_THEME, isTheme, normalizeTheme, readStoredTheme, applyTheme } =
  context.SakuraTheme;

function mockEl() {
  const attrs = {};
  return {
    attrs,
    setAttribute(name, value) { attrs[name] = value; },
    getAttribute(name) { return attrs[name]; },
  };
}

function mockStorage(initial) {
  const data = { ...initial };
  return {
    data,
    getItem(key) { return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null; },
    setItem(key, value) { data[key] = String(value); },
  };
}

test('site ships sakura, soft-violet and light themes', () => {
  assert.deepEqual(Object.keys(THEMES).sort(), ['light', 'sakura', 'violet']);
  assert.equal(DEFAULT_THEME, 'sakura');
  assert.match(html, /\[data-theme="violet"\]/);
  assert.match(html, /\[data-theme="light"\]/);
  assert.match(html, /--accent-rgb:\s*184 166 214/);
  assert.match(html, /--accent-rgb:\s*156 82 102/);
  assert.match(html, /data-theme-choice="sakura"/);
  assert.match(html, /data-theme-choice="violet"/);
  assert.match(html, /data-theme-choice="light"/);
});

test('theme switcher sits in the header as a radiogroup', () => {
  const header = html.match(/<header[\s\S]*?<\/header>/)[0];
  assert.match(header, /role="radiogroup"/);
  assert.match(header, /aria-label="Тема оформления"/);
  assert.match(header, /aria-label="Мягкий фиолетовый"/);
  assert.match(header, /aria-label="Светлая"/);
  assert.match(header, /class="theme-switch[^"]*"/);
});

test('normalizeTheme keeps known ids and falls back to sakura', () => {
  assert.equal(normalizeTheme('violet'), 'violet');
  assert.equal(normalizeTheme('light'), 'light');
  assert.equal(normalizeTheme('sakura'), 'sakura');
  assert.equal(normalizeTheme('nope'), 'sakura');
  assert.equal(normalizeTheme(null), 'sakura');
  assert.equal(isTheme('violet'), true);
  assert.equal(isTheme('amber'), false);
});

test('readStoredTheme reads a valid value and ignores junk', () => {
  assert.equal(readStoredTheme(mockStorage({ [STORAGE_KEY]: 'violet' })), 'violet');
  assert.equal(readStoredTheme(mockStorage({ [STORAGE_KEY]: 'lime' })), 'sakura');
  assert.equal(readStoredTheme(mockStorage({})), 'sakura');
  assert.equal(readStoredTheme({
    getItem() { throw new Error('blocked'); },
  }), 'sakura');
});

test('applyTheme writes data-theme, browser chrome color and storage', () => {
  const root = mockEl();
  const meta = mockEl();
  const storage = mockStorage();
  assert.equal(applyTheme(root, 'violet', meta, storage), 'violet');
  assert.equal(root.getAttribute('data-theme'), 'violet');
  assert.equal(meta.getAttribute('content'), THEMES.violet.color);
  assert.equal(storage.getItem(STORAGE_KEY), 'violet');
});

test('applyTheme rejects unknown ids without breaking the page', () => {
  const root = mockEl();
  const meta = mockEl();
  const storage = mockStorage();
  assert.equal(applyTheme(root, 'unknown', meta, storage), 'sakura');
  assert.equal(root.getAttribute('data-theme'), 'sakura');
  assert.equal(meta.getAttribute('content'), THEMES.sakura.color);
});
