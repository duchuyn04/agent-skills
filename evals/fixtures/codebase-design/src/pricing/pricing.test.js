const test = require('node:test');
const assert = require('node:assert');
const { getSubtotal } = require('./get-subtotal');
const { getCouponRate } = require('./get-coupon-rate');
const { getTaxRate } = require('./get-tax-rate');
const { roundCents } = require('./round-cents');
const { applyDiscount, applyTax } = require('./apply-rate');

test('getSubtotal sums lines', () => {
  assert.strictEqual(getSubtotal([{ unitCents: 250, quantity: 2 }, { unitCents: 100, quantity: 1 }]), 600);
});

test('getCouponRate knows SAVE10 and ignores unknown codes', () => {
  assert.strictEqual(getCouponRate('SAVE10'), 0.1);
  assert.strictEqual(getCouponRate('NOPE'), 0);
});

test('getTaxRate by region', () => {
  assert.strictEqual(getTaxRate('EU'), 0.21);
  assert.strictEqual(getTaxRate('JP'), 0);
});

test('roundCents rounds half up', () => {
  assert.strictEqual(roundCents(10.5), 11);
});

test('applyDiscount and applyTax', () => {
  assert.strictEqual(applyDiscount(1000, 0.1), 900);
  assert.strictEqual(applyTax(1000, 0.08), 1080);
});
