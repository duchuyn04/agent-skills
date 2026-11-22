const db = require('../db');

async function checkStock(lines) {
  for (const line of lines) {
    const rows = await db.query('select qty from stock where sku = $1', [line.sku]);
    if (rows[0].qty < line.quantity) throw new Error(`out of stock: ${line.sku}`);
  }
}

module.exports = { checkStock };
