export function calculateNewPrices(price, compareAtPrice, ruleType, valueInput) {
  const numericPrice = parseFloat(price);
  let numericCompare = compareAtPrice ? parseFloat(compareAtPrice) : null;

  let newPrice = numericPrice;
  let newCompare = compareAtPrice;

  switch (ruleType) {
    case 'percent-of-compare':
      if (!numericCompare) {
        numericCompare = numericPrice;
      }
      newCompare = numericCompare.toFixed(2);
      newPrice = (numericCompare * (1 - valueInput / 100)).toFixed(2);
      break;

    case 'fixed-amount-of-compare':
      if (!numericCompare) {
        numericCompare = numericPrice;
      }
      newCompare = numericCompare.toFixed(2);
      newPrice = (numericCompare - valueInput).toFixed(2);
      break;

    case 'match-compare-to-price':
      newCompare = numericPrice.toFixed(2);
      newPrice = numericPrice.toFixed(2);
      break;

    case 'change-price-by-percent':
      newPrice = (numericPrice * (1 - valueInput / 100)).toFixed(2);
      newCompare = compareAtPrice;
      break;

    case 'change-price-to-fixed':
      newPrice = valueInput.toFixed(2);
      newCompare = compareAtPrice;
      break;

    case 'toggle':
      newPrice = numericCompare?.toFixed(2) || numericPrice.toFixed(2);
      newCompare = numericPrice.toFixed(2);
      break;

    default:
      newPrice = numericPrice.toFixed(2);
      newCompare = compareAtPrice;
  }

  return [newPrice, newCompare];
}
