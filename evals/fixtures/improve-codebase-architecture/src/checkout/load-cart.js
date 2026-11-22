const { cartRepo } = require('./cart-repo');

function loadCart(cartId) {
  return cartRepo.find(cartId);
}

module.exports = { loadCart };
