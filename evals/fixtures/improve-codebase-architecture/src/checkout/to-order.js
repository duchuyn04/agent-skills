function toOrder(cart) {
  return { customerId: cart.customerId, lines: cart.lines, status: 'placed' };
}

module.exports = { toOrder };
