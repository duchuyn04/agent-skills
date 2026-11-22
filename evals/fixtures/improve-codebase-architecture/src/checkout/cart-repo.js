const db = require('../db');

const cartRepo = {
  find(cartId) {
    return db.query('select * from carts where id = $1', [cartId]);
  },
  clear(cartId) {
    return db.query('delete from cart_lines where cart_id = $1', [cartId]);
  },
};

module.exports = { cartRepo };
