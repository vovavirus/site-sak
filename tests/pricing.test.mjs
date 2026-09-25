import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const match = html.match(/<script id="pricing-logic">([\s\S]*?)<\/script>/);
assert.ok(match, 'pricing-logic script not found in index.html');

const context = vm.createContext({});
vm.runInContext(match[1], context);
const { PRICING, calcLicense, clampSeats, pluralYears, formatRub, seatsBucket, tierPricing, minTierPrice } =
  context.SakuraPricing;

const normalizeSpaces = (s) => s.replace(/[\s\u00A0\u202F]/g, ' ');

test('calcLicense multiplies seats, price and years', () => {
  const pricing = { pricePerSeatYear: 1000, renewalFactor: 1 };
  const r = calcLicense(500, 3, pricing);
  assert.equal(r.total, 1_500_000);
  assert.equal(r.perSeatYear, 1000);
  assert.equal(r.seats, 500);
  assert.equal(r.years, 3);
});

test('calcLicense applies renewal factor to years after the first', () => {
  const pricing = { pricePerSeatYear: 1000, renewalFactor: 0.5 };
  const r = calcLicense(100, 3, pricing);
  assert.equal(r.total, 100 * 1000 * 2);
  assert.ok(Math.abs(r.perSeatYear - 2000 / 3) < 1e-9);
});

test('calcLicense guards against invalid input', () => {
  const pricing = { pricePerSeatYear: 1000, renewalFactor: 1 };
  assert.deepEqual({ ...calcLicense('abc', 0, pricing) }, { seats: 0, years: 1, total: 0, perSeatYear: 0 });
  assert.equal(calcLicense(-5, 2, pricing).total, 0);
  assert.equal(calcLicense(10.9, 1.7, pricing).total, 10 * 1000);
});

test('calcLicense uses default tier pricing when none passed', () => {
  const defaultPrice = PRICING.tiers[PRICING.defaultTier].pricePerSeatYear;
  assert.equal(typeof defaultPrice, 'number');
  assert.equal(calcLicense(10, 1).total, 10 * defaultPrice);
});

test('tierPricing returns price for priced tiers and null otherwise', () => {
  assert.deepEqual({ ...tierPricing('base') }, {
    pricePerSeatYear: PRICING.tiers.base.pricePerSeatYear,
    renewalFactor: PRICING.renewalFactor,
  });
  assert.equal(tierPricing('enterprise'), null);
  assert.equal(tierPricing('unknown'), null);
});

test('calcLicense differs by tier', () => {
  const base = calcLicense(100, 1, tierPricing('base')).total;
  const zt = calcLicense(100, 1, tierPricing('zerotrust')).total;
  assert.ok(zt > base, 'recommended tier should cost more than base');
});

test('minTierPrice ignores tiers with individual pricing', () => {
  const priced = Object.values(PRICING.tiers)
    .map((t) => t.pricePerSeatYear)
    .filter((p) => typeof p === 'number');
  assert.equal(minTierPrice(), Math.min(...priced));
});

test('tier ids in markup match pricing data', () => {
  const ids = Object.keys(PRICING.tiers);
  const inMarkup = (re) => [...html.matchAll(re)].map((m) => m[1]);
  for (const id of inMarkup(/data-tier="([^"]+)"/g)) assert.ok(ids.includes(id), `unknown data-tier ${id}`);
  for (const id of inMarkup(/data-tier-price="([^"]+)"/g)) assert.ok(tierPricing(id), `tier ${id} has no price`);
  assert.deepEqual(inMarkup(/name="tier" value="([^"]+)"/g).sort(), ids.slice().sort());
  assert.ok(html.includes(`name="tier" value="${PRICING.defaultTier}" checked`), 'default tier must be preselected');
});

test('clampSeats keeps value within calculator range', () => {
  assert.equal(clampSeats(0), PRICING.minSeats);
  assert.equal(clampSeats(999999), PRICING.maxSeats);
  assert.equal(clampSeats('250.4'), 250);
  assert.equal(clampSeats('abc'), PRICING.minSeats);
});

test('pluralYears uses correct Russian forms', () => {
  assert.equal(pluralYears(1), '1 год');
  assert.equal(pluralYears(2), '2 года');
  assert.equal(pluralYears(4), '4 года');
  assert.equal(pluralYears(5), '5 лет');
  assert.equal(pluralYears(11), '11 лет');
  assert.equal(pluralYears(12), '12 лет');
  assert.equal(pluralYears(21), '21 год');
  assert.equal(pluralYears(22), '22 года');
});

test('formatRub groups thousands and appends ruble sign', () => {
  assert.equal(normalizeSpaces(formatRub(1500000)), '1 500 000 ₽');
  assert.equal(normalizeSpaces(formatRub(999.6)), '1 000 ₽');
});

test('seatsBucket maps seat count to form options', () => {
  assert.equal(seatsBucket(50), 'до 100');
  assert.equal(seatsBucket(100), '100–500');
  assert.equal(seatsBucket(500), '100–500');
  assert.equal(seatsBucket(2000), '500–2000');
  assert.equal(seatsBucket(10000), '2000–10000');
  assert.equal(seatsBucket(10001), 'более 10000');
});

test('seatsBucket values exist as options in the lead form', () => {
  for (const seats of [50, 300, 1000, 5000, 20000]) {
    assert.ok(html.includes(`<option value="${seatsBucket(seats)}">`), `missing option for ${seats}`);
  }
});
