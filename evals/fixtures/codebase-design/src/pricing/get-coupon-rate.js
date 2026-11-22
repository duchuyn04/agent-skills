const RATES = { SAVE10: 0.1, SAVE20: 0.2 };

function getCouponRate(code) {
  return RATES[code] || 0;
}

module.exports = { getCouponRate };
