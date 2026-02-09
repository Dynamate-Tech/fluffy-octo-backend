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
        // We update the actual 'compare' variable, not just a temporary one
          compare = base.toFixed(2); 
          explanation = '📝 Compare-at was empty → Copied from base';
        } else {
          explanation = '✅ Compare-at already exists';
        }
  
        // Base price stays the same
        newPrice = base.toFixed(2);
       break;

      case 'copy_to_base':
         // 1. Check if the base and compare prices are already the same.
          if (base == compare) {
            newPrice = base.toFixed(2);
            explanation = '⚠️ Base and Compare-at prices are already the same, skipped.';
            // We don't need to change newPrice or newCompareAtPrice since they are already effectively set by 'base' and 'compare'.
          } 
        // 2. Check if a compare price exists to copy from.
          else if (compare) {
            // Only execute copy if they are different AND 'compare' exists.
            newPrice = compare.toFixed(2);
            explanation = '💸 Base price copied from Compare-at price.'; 
          } 
        // 3. Fallback if 'compare' price is missing.
          else {
            newPrice = base.toFixed(2); // Retain existing base price
            explanation = '⚠️ No compare-at price, skipped.';
          }
        break;
        
      case 'compare_percentage':
    if (compare && base && !isNaN(compare) && !isNaN(base)) {
        
        // 1. Calculate the current discount percentage
        let currentDiscountPercentage = 0;
        if (compare > base) {
            currentDiscountPercentage = ((compare - base) / compare) * 100;
        }

        // 2. Logic: If already have discount (> 0), then skip
        if (currentDiscountPercentage > 0) {
            explanation = `⚠️ Already has a ${currentDiscountPercentage.toFixed(2)}% discount, skipped.`;
            
        } else {
            // 3. Else (no discount), apply 10%
            newPrice = (compare * 0.90).toFixed(2);
            newCompareAtPrice = compare.toFixed(2);
            explanation = `✅ No discount found. Applied 10% discount. New Price: ${newPrice}`;
        }

    } else {
        explanation = '⚠️ Invalid or missing base/compare prices, skipped.';
    }
    break;

      case 'compare_fixed':
        // Check if the base price is the SAME as the compare price (not discounted yet)
          if (compare == base) { 
            if (compare && !isNaN(compare)) {
              newPrice = (compare - discountValue).toFixed(2);
              explanation = `💸 Base = Compare-at - ${discountValue}`;
            } else {
              newPrice = base.toFixed(2);
              explanation = '⚠️ No compare-at price, skipped.';
            }
          } else {
          // If compare and base are different, it means it's already discounted
            newPrice = base.toFixed(2);
            explanation = '⚠️ Product already discounted, skipped.';
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
