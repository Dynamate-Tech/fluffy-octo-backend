import { shopifyGraphQL } from '../shopifyClient.js';
import { getVariantsToUpdate } from './variantFetcher.js';

const priceChangeLog = [];

export function calculateNewPricesWithExplanation(price, compareAtPrice, ruleType, valueInput) {
  const numericPrice = parseFloat(price);
  const numericCompare = compareAtPrice ? parseFloat(compareAtPrice) : null;

  let newPrice = numericPrice;
  let newCompare = compareAtPrice;
  let explanation = '';

  switch (ruleType) {
    case 'toggle':
      newPrice = numericCompare;
      newCompare = numericPrice;
      explanation = 'Toggled base and compare-at prices.';
      break;

    case 'percent-of-compare':
      if (!numericCompare) {
        newCompare = numericPrice;
        explanation = 'Compare-at price missing, fallback to base price. New price is X% off base.';
      } else {
        explanation = 'New price is X% off compare-at price.';
      }
      newPrice = ((numericCompare || numericPrice) * (1 - valueInput / 100)).toFixed(2);
      newCompare = (numericCompare || numericPrice).toFixed(2);
      break;

    case 'fixed-of-compare':
      if (!numericCompare) {
        newCompare = numericPrice;
        explanation = 'Compare-at price missing, fallback to base price. New price is base - fixed value.';
      } else {
        explanation = 'New price is compare-at minus fixed value.';
      }
      newPrice = ((numericCompare || numericPrice) - valueInput).toFixed(2);
      newCompare = (numericCompare || numericPrice).toFixed(2);
      break;

    case 'match-compare-if-empty':
      newPrice = numericPrice.toFixed(2);
      if (!compareAtPrice) {
        newCompare = numericPrice.toFixed(2);
        explanation = 'Compare-at was empty, matched it to base price.';
      } else {
        newCompare = numericCompare.toFixed(2);
        explanation = 'Compare-at was already present, no change.';
      }
      break;

    case 'percent-of-base':
      newPrice = (numericPrice * (1 - valueInput / 100)).toFixed(2);
      newCompare = compareAtPrice;
      explanation = 'Base price updated to be X% off original base. Compare-at unchanged.';
      break;

    case 'fixed-of-base':
      newPrice = (numericPrice - valueInput).toFixed(2);
      newCompare = compareAtPrice;
      explanation = 'Base price reduced by fixed amount. Compare-at unchanged.';
      break;

    default:
      explanation = 'No rule matched. No changes applied.';
      newPrice = numericPrice.toFixed(2);
      newCompare = compareAtPrice;
  }

  return {
    newPrice,
    newCompare,
    explanation: explanation.replace('X', valueInput),
  };
}

export async function applyPriceRules({ filterType, filterValue, ruleType, valueInput }) {
  const variants = await getVariantsToUpdate(filterType, filterValue);

  for (const variant of variants) {
    const { variant_id, price, compare_at_price } = variant;

    const { newPrice, newCompare, explanation } = calculateNewPricesWithExplanation(price, compare_at_price, ruleType, valueInput);

    const finalCompareAtPrice = newCompare !== undefined && newCompare !== null ? newCompare : compare_at_price;

    console.log('🔎 Variant about to be updated:', {
      variant_id,
      original_price: price,
      original_compare: compare_at_price,
      newPrice,
      newCompare: finalCompareAtPrice,
      explanation,
    });

    const mutation = `
      mutation variantUpdate($input: ProductVariantInput!) {
        productVariantUpdate(input: $input) {
          productVariant {
            id
            price
            compareAtPrice
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      input: {
        id: variant_id,
        price: newPrice,
        compareAtPrice: finalCompareAtPrice,
      },
    };

    console.log('📦 Mutation variables:', variables);

    try {
      const result = await shopifyGraphQL({ query: mutation, variables });

      if (result.productVariantUpdate.userErrors.length > 0) {
        console.error(`⚠️ Shopify User Errors:`, result.productVariantUpdate.userErrors);
      } else {
        console.log(`✅ Updated ${variant_id} -> 💸 ${newPrice} / 💰 ${finalCompareAtPrice}`);
        priceChangeLog.push({
          id: variant_id,
          from: { price, compareAtPrice: compare_at_price },
          to: { price: newPrice, compareAtPrice: finalCompareAtPrice },
          explanation,
        });
      }
    } catch (err) {
      console.error(`❌ Failed to update ${variant_id}`, err.message);
    }
  }

  console.log(`🎉 Finished applying price rules (${variants.length} checked).`);
  console.log('📋 Summary of applied changes:', priceChangeLog);

  return priceChangeLog;
}
