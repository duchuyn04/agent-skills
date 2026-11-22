// "buyer" is used by the checkout page and means the same person as a customer in orders.js.
function toBuyer(customer) {
  return { buyerId: customer.id, name: customer.name };
}

module.exports = { toBuyer };
