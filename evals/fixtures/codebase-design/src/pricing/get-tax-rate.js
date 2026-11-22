const RATES = { EU: 0.21, US: 0.08 };

function getTaxRate(region) {
  return RATES[region] || 0;
}

module.exports = { getTaxRate };
