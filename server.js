const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());

// Use environment variables for safety
const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

// In-memory IP session tracking
const ipSessions = {};

function generateCouponCode() {
  return 'SAVE' + Math.random().toString(36).substring(2, 6).toUpperCase();
}

app.get('/', (req, res) => {
  res.send('Coupon Generator API is running. Use /api/get-coupon to get a coupon.');
});

app.get('/api/get-coupon', async (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const now = new Date();

  if (ipSessions[ip]) {
    const elapsed = (now - new Date(ipSessions[ip].createdAt)) / 1000;

    if (elapsed > 20 * 60) {
      // More than 20 minutes = 5% discount
      return res.json({
        code: ipSessions[ip].code5,
        discount: "5%",
        createdAt: ipSessions[ip].createdAt
      });
    } else {
      // Still within 20 minutes = 10% discount
      return res.json({
        code: ipSessions[ip].code10,
        discount: "10%",
        createdAt: ipSessions[ip].createdAt
      });
    }
  }

  try {
    const code10 = generateCouponCode();
    const code5 = generateCouponCode();

    // Create 10% discount
    const rule10 = await axios.post(
      `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/price_rules.json`,
      {
        price_rule: {
          title: `TimerDiscount10-${code10}`,
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

    const id10 = rule10.data.price_rule.id;

    await axios.post(
      `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/price_rules/${id10}/discount_codes.json`,
      {
        discount_code: { code: code10 }
      },
      {
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    );

    // Create 5% discount
    const rule5 = await axios.post(
      `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/price_rules.json`,
      {
        price_rule: {
          title: `TimerDiscount5-${code5}`,
          target_type: "line_item",
          target_selection: "all",
          allocation_method: "across",
          value_type: "percentage",
          value: "-5.0",
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

    const id5 = rule5.data.price_rule.id;

    await axios.post(
      `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/price_rules/${id5}/discount_codes.json`,
      {
        discount_code: { code: code5 }
      },
      {
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    );

    // Store session for this IP
    ipSessions[ip] = {
      createdAt: now.toISOString(),
      code10,
      code5
    };

    // Return the 10% coupon
    res.json({
      code: code10,
      discount: "10%",
      createdAt: now.toISOString()
    });

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

app.listen(3000, () => {
  console.log('Coupon API running at http://localhost:3000');
});
