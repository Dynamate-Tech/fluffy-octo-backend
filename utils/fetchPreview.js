import { shopifyGraphQL } from '../shopifyClient.js';

export async function fetchPreview({ tag, collectionId }) {
  if (!tag && !collectionId) return [];

  const allVariants = [];
  let hasNextPage = true;
  let cursor = null;

  if (tag) {
    while (hasNextPage) {
      const query = `
        {
          products(first: 100${cursor ? `, after: "${cursor}"` : ''}, query: ${JSON.stringify(`tag:${tag}`)}) {
            pageInfo { hasNextPage }
            edges {
              cursor
              node {
                id
                title
                vendor
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
      `;
      const res = await shopifyGraphQL({ query });
      const products = res?.products;
      if (!products?.edges?.length) break;

      products.edges.forEach(edge => {
        const product = edge.node;
        const variants = product.variants.edges.map(v => {
          const sizeOption = v.node.selectedOptions.find(opt => opt.name.toLowerCase() === 'size');
          return {
            id: product.id,
            title: product.title,
            vendor: product.vendor,
            variant_id: v.node.id,
            price: v.node.price,
            compare_at_price: v.node.compareAtPrice,
            sku: v.node.sku,
            quantity: v.node.inventoryQuantity,
            size: sizeOption?.value || '-',
          };
        });
        allVariants.push(...variants);
      });

      hasNextPage = products.pageInfo.hasNextPage;
      cursor = hasNextPage ? products.edges.at(-1).cursor : null;
    }

  } else {
    while (hasNextPage) {
      const query = `
        {
          collection(id: "${collectionId}") {
            products(first: 100${cursor ? `, after: "${cursor}"` : ''}) {
              pageInfo { hasNextPage }
              edges {
                cursor
                node {
                  id
                  title
                  vendor
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
      const res = await shopifyGraphQL({ query });
      const products = res?.collection?.products;
      if (!products?.edges?.length) break;

      products.edges.forEach(edge => {
        const product = edge.node;
        const variants = product.variants.edges.map(v => {
          const sizeOption = v.node.selectedOptions.find(opt => opt.name.toLowerCase() === 'size');
          return {
            id: product.id,
            title: product.title,
            vendor: product.vendor,
            variant_id: v.node.id,
            price: v.node.price,
            compare_at_price: v.node.compareAtPrice,
            sku: v.node.sku,
            quantity: v.node.inventoryQuantity,
            size: sizeOption?.value || '-',
          };
        });
        allVariants.push(...variants);
      });

      hasNextPage = products.pageInfo.hasNextPage;
      cursor = hasNextPage ? products.edges.at(-1).cursor : null;
    }
  }

  return allVariants;
}
