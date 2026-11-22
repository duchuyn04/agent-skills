// "account" here is a paying party, not a login.
function openBillingAccount(client) {
  return { accountId: `bill_${client.id}`, clientId: client.id, balanceCents: 0 };
}

function createInvoice(billingAccount, order) {
  return { orderId: order.id, billTo: billingAccount.accountId, totalCents: order.totalCents };
}

module.exports = { openBillingAccount, createInvoice };
