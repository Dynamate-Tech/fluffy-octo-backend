// shopifyClient.js
import dotenv from 'dotenv';
dotenv.config();

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const SHOP = process.env.SHOP_DOMAIN;
const ADMIN_API_ACCESS_TOKEN = process.env.ADMIN_API_ACCESS_TOKEN;

export async function shopifyGraphQL({ query, variables = {} }) {
  // console.log('\n📤 [GraphQL QUERY] =====================');
  // console.log(query);
  // if (Object.keys(variables).length) {
  //   console.log('📦 Variables:', JSON.stringify(variables, null, 2));
  // }

  try {
    const response = await fetch(
      `https://${SHOP}/admin/api/2025-10/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': ADMIN_API_ACCESS_TOKEN,
        },
        body: JSON.stringify({ query, variables }),
      }
    );

    const result = await response.json();

    // 👇 Remove this if you don’t want full object dumps
    // console.dir(result, { depth: null });

    if (result.errors) {
      console.error('\n❌ [Shopify GraphQL Error]');
      console.error(JSON.stringify(result.errors, null, 2));
      throw new Error('Shopify GraphQL Error');
    }

    return result.data;
  } catch (err) {
    console.error('\n💥 [Fetch/Network Error]');
    console.error(err.message || err);
    throw err;
  }
}
