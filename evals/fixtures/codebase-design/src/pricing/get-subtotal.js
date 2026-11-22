function getSubtotal(lines) {
  return lines.reduce((sum, line) => sum + line.unitCents * line.quantity, 0);
}

module.exports = { getSubtotal };
