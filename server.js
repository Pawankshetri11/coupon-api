// server.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());

//  Replace with your actual store domain and token (NO http://, NO trailing slash)
const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

// Generate a short random code
function generateCouponCode() {
  return 'SAVE' + Math.random().toString(36).substring(2, 6).toUpperCase();
}

// Optional root route
app.get('/', (req, res) => {
  res.send('Coupon Generator API is running. Use /api/get-coupon to get a coupon.');
});

// Main coupon generation endpoint
app.get('/api/get-coupon', async (req, res) => {
  const code = generateCouponCode();
  const now = new Date();

  try {
    // Step 1: Create price rule
    const priceRuleResponse = await axios.post(
      `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/price_rules.json`,
      {
        price_rule: {
          title: `TimerDiscount-${code}`,
          target_type: "line_item",
          target_selection: "all",
          allocation_method: "across",
          value_type: "percentage",
          value: "-10.0",
          customer_selection: "all",
          once_per_customer: true,
          usage_limit: 1,
          starts_at: now.toISOString(),
          ends_at: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString()
        }

      },
      {
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    );

    const priceRuleId = priceRuleResponse.data.price_rule.id;

    // Step 2: Create discount code using that price rule
    const discountResponse = await axios.post(
      `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/price_rules/${priceRuleId}/discount_codes.json`,
      {
        discount_code: { code }
      },
      {
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    );

    // Success: send code and timestamp
    res.json({ code, createdAt: now.toISOString() });

  } catch (error) {
    if (error.response) {
      console.error("🔴 Shopify API Error:", error.response.status);
      console.error("🔴 Response Data:", JSON.stringify(error.response.data, null, 2));
    } else {
      console.error("🔴 Error:", error.message);
    }
    res.status(500).json({ error: "Failed to create discount code" });
  }

});

// Start the server
app.listen(3000, () => {
  console.log('Coupon API running at http://localhost:3000');
});
