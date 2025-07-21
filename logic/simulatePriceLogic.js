export function simulatePriceChanges(variants, ruleType, discountValue) {
  return variants.map((variant) => {
    const base = parseFloat(variant.price);
    const compare = parseFloat(variant.compare_at_price);
    let newPrice = null;
    let explanation = '';
    let keepCompare = compare;

    switch (ruleType) {
      case 'base_percentage':
        newPrice = (base * (1 - discountValue / 100)).toFixed(2);
        explanation = `💸 Base = Base - ${discountValue}%`;
        break;

      case 'base_fixed':
        newPrice = discountValue.toFixed(2);
        explanation = `💸 Base = Fixed Price ${discountValue}`;
        break;

      case 'copy_to_compare':
        if (!compare || isNaN(compare)) {
          keepCompare = base.toFixed(2);
          explanation = '📝 Compare-at was empty → Copied from base';
        } else {
          explanation = '✅ Compare-at already exists';
        }
        newPrice = base.toFixed(2);
        break;

      case 'copy_to_base':
        if (compare) {
           newPrice = compare.toFixed(2);
           explanation = '💸 Base price copied from Compare-at price.'; 
         } else {
           newPrice = base.toFixed(2); // fallback if compare price is missing
           explanation = '⚠️ No compare-at price, skipped.';
         }
        break;
        
      case 'compare_percentage':
        if (compare && !isNaN(compare)) {
          newPrice = (compare * (1 - discountValue / 100)).toFixed(2);
          explanation = `💸 Base = Compare-at - ${discountValue}%`;
        } else {
          newPrice = base.toFixed(2);
          explanation = '⚠️ No compare-at available, kept base';
        }
        break;

      case 'compare_fixed':
        if (compare && !isNaN(compare)) {
          newPrice = (compare - discountValue).toFixed(2);
          explanation = `💸 Base = Compare-at - ${discountValue}`;
        } else {
          newPrice = base.toFixed(2);
          explanation = '⚠️ No compare-at available, kept base';
        }
        break;

      default:
        newPrice = base.toFixed(2);
        explanation = '❓ Unknown rule type';
    }

    return {
      ...variant,
      simulated_price: newPrice,
      explanation,
    };
  });
}
