// server/index.js
import dotenv from 'dotenv';
dotenv.config(); // ✅ FIRST, before anything else
import { shopifyGraphQL } from './shopifyClient.js'; // ✅ AFTER dotenv.config()
import express from 'express';
import axios from 'axios';
import cors from 'cors';
import bodyParser from 'body-parser';
import { schedulePriceChange, startScheduler } from './utils/priceScheduler.js';
import { simulatePriceChanges } from './logic/simulatePriceLogic.js';
import fs from 'fs';
import path from 'path';
import { sendEmail, generateEmailBodyFromChanges } from './utils/emailHelpers.js';
import { fetchPreview } from './utils/fetchPreview.js';
import { saveToken, getToken } from "./tokenStore.js";


const app = express();
const PORT = process.env.PORT || 3001;
const scheduledJobs = [];

app.use(express.json());

app.use(cors({
  origin: "https://dynamate-promo-front.onrender.com"
  credentials: true
}));

//----------------------------
// Token Status
//----------------------------
app.get("/status", (req, res) => {
  const token = getToken();

  if (!token) {
    return res.json({
      connected: false
    });
  }

  return res.json({
    connected: true
  });
});

// ------------------------
// Get Auth 
//-------------------------
app.get("/auth", (req, res) => {
  const shop = req.query.shop;

  const installUrl =
    `https://${shop}/admin/oauth/authorize` +
    `?client_id=${process.env.SHOPIFY_API_KEY}` +
    `&scope=${process.env.SHOPIFY_SCOPES}` +
    `&redirect_uri=${process.env.SHOPIFY_REDIRECT_URI}`;

  res.redirect(installUrl);
});

//-------------------------------------
// Auth Callback (Access Token)
//-------------------------------------
app.get("/auth/callback", async (req, res) => {
  const { shop, code } = req.query;

  const response = await fetch(
    `https://${shop}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_API_KEY,
        client_secret: process.env.SHOPIFY_API_SECRET,
        code,
      }),
    }
  );

  const data = await response.json();

  // ✅ Save token
  saveToken(data.access_token);

  // ✅ Redirect back to frontend
  res.redirect("https://dynamate-promo-front.onrender.com?connected=true");
});


// -------------------------
// 🔹 Get all tags (GraphQL)
// -------------------------
app.get('/tags', async (req, res) => {
  try {
    let hasNextPage = true;
    let cursor = null;
    let allTags = [];

    while (hasNextPage) {
      const query = `
        query GetProductTags($cursor: String) {
          products(first: 100, after: $cursor) {
            pageInfo {
              hasNextPage
            }
            edges {
              cursor
              node {
                tags
              }
            }
          }
        }
      `;

      const variables = cursor ? { cursor } : {};
      const data = await shopifyGraphQL({ query, variables });

      const edges = data.products.edges;
      edges.forEach(edge => {
        allTags.push(...(edge.node.tags || []));
      });

      hasNextPage = data.products.pageInfo.hasNextPage;
      cursor = hasNextPage ? edges[edges.length - 1].cursor : null;
    }

   const uniqueTags = [...new Set(allTags.filter(Boolean))].sort((a, b) => a.localeCompare(b));
   res.json(uniqueTags);
  } catch (err) {
    console.error("❌ Failed to fetch tags:", err.message);
    res.status(500).json({ error: "Failed to fetch tags" });
  }
});

// -------------------------
// 🔹 Get all collections (GraphQL)
// -------------------------
app.get('/collections', async (req, res) => {
  try {
    let hasNextPage = true;
    let cursor = null;
    const allCollections = [];

    while (hasNextPage) {
      const query = `
        {
          collections(first: 100${cursor ? `, after: "${cursor}"` : ''}) {
            pageInfo {
              hasNextPage
            }
            edges {
              cursor
              node {
                id
                title
                __typename
              }
            }
          }
        }
      `;

      const response = await shopifyGraphQL({ query });

      if (!response?.collections) {
        throw new Error('No collections data in response');
      }

      const collections = response.collections;

      collections.edges.forEach(edge => {
        allCollections.push({
          id: edge.node.id,
          title: edge.node.title,
          type: edge.node.__typename,
        });
      });

      hasNextPage = collections.pageInfo.hasNextPage;
      cursor = hasNextPage ? collections.edges[collections.edges.length - 1].cursor : null;
    }

    allCollections.sort((a, b) => a.title.localeCompare(b.title));
    res.json(allCollections);

  } catch (err) {
    console.error('❌ Failed to fetch collections:', err.message);
    res.status(500).json({ error: 'Failed to fetch collections' });
  }
});

// -------------------------
// 🔹 Preview products by tag or collection
// -------------------------
app.get('/preview', async (req, res) => {
  try {
    const variants = await fetchPreview({
      tag: req.query.tag,
      collectionId: req.query.collectionId
    });
    res.json(variants);
  } catch (err) {
    console.error('❌ Preview error:', err.message);
    res.status(500).json({ error: 'Preview fetch failed' });
  }
});


// -------------------------
// 🔹 Simulate price logic
// -------------------------
app.post('/simulate', async (req, res) => {
  const { filterType, filterValue, ruleType, discountValue } = req.body;

  try {
    const params = filterType === 'tag'
      ? { tag: filterValue }
      : filterType === 'collection'
      ? { collectionId: filterValue }
      : {};

    //const response = await axios.get('http://localhost:3001/preview', { params });
    //const variants = response.data;
     const variants = await fetchPreview(params);

    const simulated = simulatePriceChanges(variants, ruleType, discountValue);
    res.json(simulated);
  } catch (err) {
    console.error('❌ Simulate failed:', err.message || err);
    res.status(500).json({ error: 'Simulation failed' });
  }
});

// -------------------------
// 🔹 Apply price logic
// -------------------------
async function applyPriceLogic({ filterType, filterValue, ruleType, discountValue }) {
  console.log('🔧 Applying price logic...', { filterType, filterValue, ruleType, discountValue });

  const params = filterType === 'tag'
    ? { tag: filterValue }
    : filterType === 'collection'
    ? { collectionId: filterValue }
    : {};

  try {
    const variants = await fetchPreview(params);

    console.log(`📦 Variants found: ${variants.length}`);
    if (variants.length === 0) {
      console.warn('⚠️ No variants returned. Check your tag/collection filter.');
    }

    const priceChangeLog = [];

    for (const variant of variants) {
      const base = parseFloat(variant.price);
      const compare = parseFloat(variant.compare_at_price);
      const variantId = variant.variant_id;
      const productId = variant.product_id; // Assuming fetchPreview returns product_id, if not, this will need to be fetched.

      let newPrice = null;
      let newCompareAtPrice = null;
      let explanation = '';

      switch (ruleType) {
        case 'base_percentage':
          newPrice = (base * (1 - discountValue / 100)).toFixed(2);          
          newCompareAtPrice = compare.toFixed(2);
          explanation = `💸 Base price reduced by ${discountValue}%`;
        break;

        case 'base_fixed':
          newPrice = parseFloat(discountValue).toFixed(2);
          newCompareAtPrice = compare.toFixed(2);
          explanation = `💸 Base price set to fixed amount: ${newPrice}`;
        break;

        case 'copy_to_compare':
          if (!compare || isNaN(compare)) {
            newCompareAtPrice = base.toFixed(2);
            explanation = '📋 Compare-at was empty, copied from base price.';
          } else {
            explanation = '⚠️ Compare-at already exists, skipped.';
          }
        break;

        case 'copy_to_base':
        // 1. Check if the base and compare prices are already the same.
          if (base == compare) {
            explanation = '⚠️ Base and Compare-at prices are already the same, skipped.';
            // We don't need to change newPrice or newCompareAtPrice since they are already effectively set by 'base' and 'compare'.
          } 
        // 2. Check if a compare price exists to copy from.
          else if (compare) {
            // Only execute copy if they are different AND 'compare' exists.
            newPrice = compare.toFixed(2);
            newCompareAtPrice = compare.toFixed(2);
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

            // Check if the current discount is less than 20%
            if (currentDiscountPercentage <= 20) {
                // The condition is met: Apply the new percentage discount to the compare price
                newPrice = (compare * (1 - discountValue / 100)).toFixed(2);
                newCompareAtPrice = compare.toFixed(2);
                explanation = `✅ Current discount (${currentDiscountPercentage.toFixed(2)}%) <= 20%. Applied ${discountValue}% discount to Compare price.`;
            } else {
                // The product is already discounted by 20% or less
                explanation = `⚠️ Product already discounted by ${currentDiscountPercentage.toFixed(2)}% (>= 20%), skipped.`;
            }

        } else if (compare == base) {
            // Fallback for when compare == base (i.e., 0% discount, which is < 30%)
            if (compare && !isNaN(compare)) {
                newPrice = (compare * (1 - discountValue / 100)).toFixed(2);
                newCompareAtPrice = compare.toFixed(2);
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
            if (compare && !isNaN(compare)) {
              newPrice = (compare - discountValue).toFixed(2);
              newCompareAtPrice = compare.toFixed(2);
              explanation = `💸 Base = Compare-at - ${discountValue}`;
            } else {
              explanation = '⚠️ No compare-at price, skipped.';
            }          
        break;

          console.log("🧪 Received ruleType:", ruleType);

        default:
          console.warn(`❌ Unknown ruleType: ${ruleType}`);
      }

      if (newPrice || newCompareAtPrice) {
        try {
// NOTE: We are now using the bulk update approach for efficiency
          // We will collect all updates and perform a single bulk update per product at the end of the loop.
          // For now, we will use the single variant wrapper to maintain the existing logic flow.
          // For optimal performance, the logic should be refactored to collect all updates and call updateMultipleVariantPrices once.
          await updateVariantPrice(variantId, {
            price: newPrice,
            compareAtPrice: newCompareAtPrice,
          });

          const logEntry = {
            id: variantId,
            vendor: variant.vendor,
            title: variant.title,
            sku: variant.sku,
            from: {
              price: base,
              compareAtPrice: compare,
            },
            to: {
              price: newPrice || base,
              compareAtPrice: newCompareAtPrice || compare,
            },
            explanation,
          };

          priceChangeLog.push(logEntry);

          console.log(`✅ Updated ${variantId}:`, logEntry);
        } catch (err) {
          console.error(`❌ Failed to update variant ${variantId}:`, err.message || err);
        }
      } else {
        console.log(`⏭️ No change needed for variant ${variantId}: ${explanation}`);
      }
    }

    console.log('🎉 Finished applying price rules!');

    return priceChangeLog;
  } catch (err) {
    console.error('❌ applyPriceLogic failed:', err.message || err);
    return [];
  }
}


// 🔹 Apply now
app.post('/apply-now', async (req, res) => {
  try {
    const { filterType, filterValue, ruleType, discountValue } = req.body;
    await applyPriceLogic({ filterType, filterValue, ruleType, discountValue });
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Apply now error:', err.message || err);
    res.status(500).json({ error: 'Apply now failed' });
  }
});

// -------------------------
// 🔹 Get Product ID from Variant ID (Helper function)
// -------------------------
async function getProductIdFromVariant(variantId) {
  const query = `
    query getProductFromVariant($id: ID!) {
      productVariant(id: $id) {
        id
        product {
          id
        }
      }
    }
  `;

  const variables = { id: variantId };
  const response = await shopifyGraphQL({ query, variables });
  
  if (!response?.productVariant?.product?.id) {
    throw new Error("Product ID not found for variant: " + variantId);
  }

  return response.productVariant.product.id;
}

// -------------------------
// 🔹 Update Multiple Variant Prices (Core Function)
// -------------------------
export async function updateMultipleVariantPrices(productId, variants) {
  const mutation = `
    mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        product {
          id
        }
        productVariants {
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
    productId: productId,
    variants: variants.map(v => ({
      id: v.id,
      price: v.price?.toString(), // Ensure price is a string
      compareAtPrice: v.compareAtPrice?.toString() || null
    }))
  };
  
  console.log("📤 Sending bulk update for product: " + productId + " (" + variants.length + " variants)");

  const response = await shopifyGraphQL({ query: mutation, variables });

  const bulkUpdateResponse = response.productVariantsBulkUpdate;

  if (bulkUpdateResponse?.userErrors?.length) {
    console.error("❌ Shopify mutation userErrors:", bulkUpdateResponse.userErrors);
    throw new Error(bulkUpdateResponse.userErrors.map(e => e.message).join(', '));
  }

  console.log("✅ Mutation success for product: " + productId + ". Updated " + bulkUpdateResponse.productVariants.length + " variants.");
  return bulkUpdateResponse.productVariants;
}

// -------------------------
// 🔹 Update Variant Price (Single Variant Wrapper)
// -------------------------
async function updateVariantPrice(variantId, { price, compareAtPrice }) {
  // NOTE: This function is now a wrapper that fetches the product ID and calls the bulk update.
  // It is kept for compatibility with the existing code structure.
  const productId = await getProductIdFromVariant(variantId);
  
  const variants = [{
    id: variantId,
    price: price,
    compareAtPrice: compareAtPrice
  }];

  const updatedVariants = await updateMultipleVariantPrices(productId, variants);
  
  if (updatedVariants.length === 0) {
    throw new Error("Failed to update variant: " + variantId + " (No variant returned)");
  }
  
  return updatedVariants[0];
}

// -------------------------
// 🔹 Apply price schedules to variants
// -------------------------
app.post('/apply-schedule', async (req, res) => {
  const { title, filterType, filterValue, ruleType, discountValue, startDate, endDate } = req.body;

  try {
    let updatedChanges = [];

    // 🔹 Apply immediately if no startDate
    if (!startDate) {
      updatedChanges = await applyPriceLogic({ filterType, filterValue, ruleType, discountValue });

      // ✉️ Send email with result summary table
      const batchInfo = {
        title,
        status: 'applied',
        startDate,
        endDate,
        appliedAt: new Date().toLocaleString("en-US", { timeZone: "Asia/Brunei" }),
        revertedAt: null
      };
      const emailHtml = generateEmailBodyFromChanges(updatedChanges, batchInfo);

      console.log("📨 Preparing to send email...");
      console.log("📧 Email recipient:", 'dynamate.promo@gmail.com');
      console.log("📨 Email HTML preview:", emailHtml?.slice(0, 500)); // just part of it

      try {
        await sendEmail({
          to: 'dynamate.promo@gmail.com',
          subject: `[Promo Price] ${title}`,
          html: emailHtml,
        });
        console.log('✅ Email send triggered.');
      } catch (err) {
        console.error('❌ Failed to send email:', err.message || err);
      }

    } else {
      // 🔸 Schedule apply job
      scheduleJob({
        jobType: 'apply',
        runAt: startDate,
        filterType,
        filterValue,
        ruleType,
        discountValue,
        title,
        startDate,
        endDate,
      });
    }

    // 🔸 Schedule revert if endDate exists
    if (endDate) {
      scheduleJob({
        jobType: 'revert',
        runAt: endDate,
        filterType,
        filterValue,
        title,
        startDate,
        endDate,
      });
    }

    // 📝 Save batch info to JSON
    saveBatch(title, {
      filterType,
      filterValue,
      ruleType,
      discountValue,
      startDate,
      endDate,
      status: startDate ? 'pending' : 'applied',
      appliedAt: !startDate ? new Date().toLocaleString("en-US", { timeZone: "Asia/Brunei" }) : null,
      revertedAt: null
    });


    res.json({ success: true });
  } catch (err) {
    console.error('❌ Failed to schedule apply/revert:', err.message || err);
    res.status(500).json({ error: 'Schedule failed' });
  }
});


function scheduleJob({ jobType, runAt, filterType, filterValue, ruleType, discountValue, title, startDate, endDate }) {
  const delay = new Date(runAt).getTime() - Date.now();

  if (delay < 0) {
    console.warn('🕒 Skipping job — time already passed');
    return;
  }

  const job = setTimeout(async () => {
    try {
      console.log(`🚀 Running scheduled job: ${jobType} @ ${runAt}`);

      if (jobType === 'apply') {
        const updatedChanges = await applyPriceLogic({ filterType, filterValue, ruleType, discountValue });

        const emailHtml = generateEmailBodyFromChanges(updatedChanges, {
           title,
           status: 'applied',
           startDate: null,
           endDate: null,
           appliedAt: new Date().toLocaleString("en-US", { timeZone: "Asia/Brunei" }),
           revertedAt: null
        });

        await sendEmail({
          to: 'dynamate.promo@gmail.com',
          subject: `[Promo Price] ${title}`,
          html: emailHtml,
        });

        updateBatchStatus(title, {
          status: 'applied',
          appliedAt: new Date().toLocaleString("en-US", { timeZone: "Asia/Brunei" }),
        });
        console.log('✅ Scheduled apply done & email sent.');

      } else if (jobType === 'revert') {
          await revertPriceLogic({ filterType, filterValue, title, startDate, endDate });
          console.log('✅ Scheduled revert completed via revertPriceLogic.');
        }

    } catch (err) {
      console.error(`❌ Scheduled ${jobType} failed:`, err);
    }
  }, delay);

  scheduledJobs.push({ jobType, runAt, job });
}


// 🔹 Schedule Job
app.post('/schedule-job', (req, res) => {
  const { jobType, runAt, filterType, filterValue, ruleType, discountValue } = req.body;

  if (!jobType || !runAt || !filterType || !filterValue) {
    return res.status(400).json({ error: 'Missing required fields for schedule' });
  }

  scheduleJob({ jobType, runAt, filterType, filterValue, ruleType, discountValue, title });
  res.json({ success: true, scheduledFor: runAt });
});

// 🔹 Add batches
app.get('/batches', (req, res) => {
  const batchesFile = path.join(process.cwd(), 'batches.json');
  if (!fs.existsSync(batchesFile)) return res.json([]);
  const data = JSON.parse(fs.readFileSync(batchesFile, 'utf8'));
  res.json(data);
});

// -------------------------
// 🔹 Revert price logic
// -------------------------
async function revertPriceLogic({ filterType, filterValue, title, startDate, endDate }) {
  console.log('♻️ Reverting price logic...', { filterType, filterValue, title, startDate, endDate });

  const params = filterType === 'tag'
    ? { tag: filterValue }
    : filterType === 'collection'
    ? { collectionId: filterValue }
    : {};

  const variants = await fetchPreview(params);

  const changes = [];

  for (const variant of variants) {
    const base = parseFloat(variant.price);
    const compare = parseFloat(variant.compare_at_price);

    if (compare && !isNaN(compare)) {
// NOTE: The single update call is replaced by a bulk update for the entire product
      // This requires a refactor to collect all updates and perform a single bulk update per product.
      // For simplicity and to maintain the existing logic flow, we will use the single variant wrapper.
      // For optimal performance, the logic should be refactored to collect all updates and call updateMultipleVariantPrices once.
      await updateVariantPrice(variant.variant_id, {
        price: compare.toFixed(2),
        compareAtPrice: null, // Clear compareAtPrice after reverting base price
      });

      changes.push({
        id: variant.variant_id,
        vendor: variant.vendor,
        title: variant.title,
        sku: variant.sku,
        from: {
          price: base,
          compareAtPrice: compare,
        },
to: {
          price: compare.toFixed(2),
          compareAtPrice: null, // Clear compareAtPrice after reverting base price
        },
        explanation: '♻️ Reverted base price to match compare-at',
      });
    }
  }

  // ✅ Email notification
  const emailHtml = generateEmailBodyFromChanges(changes, {
    title,
    status: 'applied', // or 'reverted'
    startDate,
    endDate,
    appliedAt: new Date().toLocaleString("en-US", { timeZone: "Asia/Brunei" }), // only when applying
    revertedAt: new Date().toLocaleString("en-US", { timeZone: "Asia/Brunei" }), // only when reverting
  });
  await sendEmail({
    to: 'dynamate.promo@gmail.com',
   subject: `[Promo Price Revert] ${title}`,
   html: emailHtml,
  });

  // ✅ Update batch status
  updateBatchStatus(title, {
    status: 'reverted',
    revertedAt: new Date().toLocaleString("en-US", { timeZone: "Asia/Brunei" }),
  });

  console.log('✅ Revert completed and email sent!');
}


// 🔹 Revert now
app.post('/revert-now', async (req, res) => {
  const { filterType, filterValue } = req.body;

  try {
    await revertPriceLogic({ filterType, filterValue, title, startDate, endDate });
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Revert error:', err.message || err);
    res.status(500).json({ error: 'Revert failed' });
  }
});


function saveBatch(title, data) {
  const batchesFile = path.join(process.cwd(), 'batches.json');
  const batches = fs.existsSync(batchesFile)
    ? JSON.parse(fs.readFileSync(batchesFile, 'utf8'))
    : [];

  batches.push({ title, createdAt: new Date().toLocaleString("en-US", { timeZone: "Asia/Brunei" }), ...data });

 fs.writeFileSync(batchesFile, JSON.stringify(batches, null, 2));
}

function updateBatchStatus(title, updates) {
  const file = path.join(process.cwd(), 'batches.json');
  if (!fs.existsSync(file)) return;

  const batches = JSON.parse(fs.readFileSync(file, 'utf8'));
  const updated = batches.map(batch => {
    if (batch.title === title) {
      return { ...batch, ...updates };
    }
    return batch;
  });

  fs.writeFileSync(file, JSON.stringify(updated, null, 2));
}


// Start the scheduler
startScheduler();


app.get('/', (req, res) => {
  res.send('Promo Toggle GraphQL Backend is running!');
});


app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log("🟢 App has started!");
});
