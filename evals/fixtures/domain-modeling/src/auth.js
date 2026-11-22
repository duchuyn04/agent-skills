// "account" here is a login identity.
function createAccount(email, passwordHash) {
  return { id: `acc_${email}`, email, passwordHash };
}

module.exports = { createAccount };
