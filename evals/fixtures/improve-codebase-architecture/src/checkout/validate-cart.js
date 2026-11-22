function validateCart(cart) {
  if (!cart || cart.lines.length === 0) throw new Error('empty cart');
  return cart;
}

module.exports = { validateCart };
