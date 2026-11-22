function placeOrder(customer, lines) {
  return { id: `ord_${Date.now()}`, customerId: customer.id, lines, status: 'placed', totalCents: 0 };
}

// Cancels the whole order. There is no way to cancel one line.
function cancelOrder(order) {
  return { ...order, status: 'cancelled' };
}

module.exports = { placeOrder, cancelOrder };
