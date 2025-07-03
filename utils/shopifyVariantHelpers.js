// shopifyVariantHelpers.js

import { shopifyGraphQL } from '../shopifyClient.js';

// Clean up a list of raw Shopify variant objects
export function cleanVariants(rawVariants) {
  return rawVariants.map(v => {
    const sizeOption = v.selectedOptions?.find(opt => opt.name.toLowerCase() === 'size');
    return {
      variant_id: v.id,
      price: v.price,
      compare_at_price: v.compareAtPrice,
      sku: v.sku,
      quantity: v.inventoryQuantity,
      size: sizeOption?.value || '-',
    };
  });
}

// Fetch variants by tag
export async function fetchAllVariantsByTag(tag) {
  const allVariants = [];
  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage) {
    const query = `
      {
        products(first: 100${cursor ? `, after: "${cursor}"` : ''}, query: "tag:\\"${tag}\\"") {
          pageInfo {
            hasNextPage
          }
          edges {
            cursor
            node {
              variants(first: 10) {
                edges {
                  node {
                    id
                    price
                    compareAtPrice
                    sku
                    inventoryQuantity
                    selectedOptions {
                      name
                      value
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const raw = await shopifyGraphQL({ query });
    const result = raw.data;

    if (!result.products) {
      throw new Error('GraphQL result missing products');
    }

    const edges = result.products.edges;
    edges.forEach(edge => {
      const rawVariants = edge.node.variants.edges.map(v => v.node);
      allVariants.push(...cleanVariantData(rawVariants));
    });

    hasNextPage = result.products.pageInfo.hasNextPage;
    cursor = hasNextPage ? edges[edges.length - 1].cursor : null;
  }

  console.log(`✅ Done fetching ${allVariants.length} variants for tag: ${tag}`);
  return allVariants;
}




// Fetch variants by collection ID
export async function fetchAllVariantsByCollection(collectionId) {
  const allVariants = [];
  let cursor = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const query = `
      {
        collection(id: "${collectionId}") {
          products(first: 100${cursor ? `, after: "${cursor}"` : ''}) {
            pageInfo { hasNextPage }
            edges {
              cursor
              node {
                variants(first: 10) {
                  edges {
                    node {
                      id
                      price
                      compareAtPrice
                      sku
                      inventoryQuantity
                      selectedOptions { name value }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const raw = await shopifyGraphQL({ query });
    const result = raw.data;

    if (!result.collection || !result.collection.products) {
      throw new Error('GraphQL result does not contain .collection.products. Response was malformed.');
    }

    const edges = result.collection.products.edges;

    edges.forEach(edge => {
      const rawVariants = edge.node.variants.edges.map(v => v.node);
      allVariants.push(...cleanVariantData(rawVariants));
    });

    hasNextPage = result.collection.products.pageInfo.hasNextPage;
    cursor = hasNextPage ? edges[edges.length - 1].cursor : null;
  }

  return allVariants;
}

