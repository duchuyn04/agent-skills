const { roundCents } = require('./round-cents');

function applyDiscount(cents, rate) {
  return roundCents(cents * (1 - rate));
}

function applyTax(cents, rate) {
  return roundCents(cents * (1 + rate));
}

module.exports = { applyDiscount, applyTax };
