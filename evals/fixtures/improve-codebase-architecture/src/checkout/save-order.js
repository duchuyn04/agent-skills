const db = require('../db');

function saveOrder(order) {
  return db.query('insert into orders (customer_id, status) values ($1, $2)', [order.customerId, order.status]);
}

module.exports = { saveOrder };
