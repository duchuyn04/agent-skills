const { loadCart } = require('./load-cart');
const { validateCart } = require('./validate-cart');
const { checkStock } = require('./check-stock');
const { toOrder } = require('./to-order');
const { saveOrder } = require('./save-order');
const { cartRepo } = require('./cart-repo');

async function placeOrder(cartId) {
  const cart = validateCart(await loadCart(cartId));
  await checkStock(cart.lines);
  const order = toOrder(cart);
  await saveOrder(order);
  await cartRepo.clear(cartId);
  return order;
}

module.exports = { placeOrder };
