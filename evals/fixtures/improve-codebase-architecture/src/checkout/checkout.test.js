const test = require('node:test');
const assert = require('node:assert');
const { validateCart } = require('./validate-cart');
const { toOrder } = require('./to-order');

test('validateCart rejects an empty cart', () => {
  assert.throws(() => validateCart({ lines: [] }), /empty cart/);
});

test('toOrder marks the order as placed', () => {
  assert.strictEqual(toOrder({ customerId: 1, lines: [{}] }).status, 'placed');
});
