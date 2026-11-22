const { getSubtotal } = require('./get-subtotal');
const { getCouponRate } = require('./get-coupon-rate');
const { getTaxRate } = require('./get-tax-rate');
const { applyDiscount, applyTax } = require('./apply-rate');

function priceOrder(order) {
  const subtotal = getSubtotal(order.lines);
  const couponRate = getCouponRate(order.couponCode);
  const discounted = applyDiscount(subtotal, couponRate);
  const taxRate = getTaxRate(order.region);
  return applyTax(discounted, taxRate);
}

module.exports = { priceOrder };
