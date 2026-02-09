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
          newPrice = base.toFixed(2); 
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
          // 1. Check if both prices are valid for calculation
          if (compare && base && !isNaN(compare) && !isNaN(base)) {
        
          // Calculate the current discount percentage (if compare > base)
          let currentDiscountPercentage = 0;
          if (compare > base) {
            // Formula: ((Original Price - Current Price) / Original Price) * 100
            currentDiscountPercentage = ((compare - base) / compare) * 100;
          }

          // Check if the current discount is less than 10%
          if (currentDiscountPercentage < 10) {
            // The condition is met: Apply the new percentage discount to the compare price
            newPrice = (compare * (1 - discountValue / 100)).toFixed(2);
            explanation = `✅ Current discount (${currentDiscountPercentage.toFixed(2)}%) < 10%. Applied ${discountValue}% discount to Compare price.`;
          } else {
            // The product is already discounted by 30% or more
            explanation = `⚠️ Product already discounted by ${currentDiscountPercentage.toFixed(2)}% (>= 10%), skipped.`;
          }

        } else if (compare == base) {
          // Fallback for when compare == base (i.e., 0% discount, which is < 10%)
          if (compare && !isNaN(compare)) {
            newPrice = (compare * (1 - discountValue / 100)).toFixed(2);
            explanation = `✅ Base = Compare-at (0% discount). Applied ${discountValue}% discount.`;
          } else {
            explanation = '⚠️ No valid compare-at price, skipped.';
          }
        } else {
          // Handle cases where prices are invalid or missing
          explanation = '⚠️ Invalid or missing base/compare prices for calculation, skipped.';
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
