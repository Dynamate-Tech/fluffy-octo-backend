// shopifyClient.js
import dotenv from 'dotenv';
dotenv.config();
import { getToken } from "./tokenStore.js";

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const SHOP = process.env.SHOP_DOMAIN;

export async function shopifyGraphQL({ query, variables = {} }) {
  const token = getToken();
  // console.log('\n📤 [GraphQL QUERY] =====================');
  // console.log(query);
  // if (Object.keys(variables).length) {
  //   console.log('📦 Variables:', JSON.stringify(variables, null, 2));
  // }

  try {
    const response = await fetch(
      `https://${SHOP}/admin/api/2026-04/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': token,
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
