const express = require("express");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const connectDB = require("./db");
const User = require("./models/user.model");
const { generateInstallUrl } = require("./utils/hubspotUtils");
const { fetchContactDetails } = require("./utils/hubspotApi");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

connectDB();
app.use(bodyParser.json());

// Health check
app.get("/", (req, res) => {
  res.send("BSS HubSpot Webhook Receiver is running on port " + PORT);
});

// Generate OAuth install URL
app.get("/api/hubspot/oauth-url/:crmUserId", (req, res) => {
  const { crmUserId } = req.params;
  if (!crmUserId) return res.status(400).send("Missing crmUserId");

  const installUrl = generateInstallUrl(crmUserId);
  return res.json({ installUrl });
});

// OAuth callback
app.get("/api/hubspot/webhook", async (req, res) => {
  const { code, state: crmUserId } = req.query;

  if (!code || !crmUserId) {
    return res.status(400).send("Missing code or crmUserId (state)");
  }

  try {
    const params = new URLSearchParams();
    params.append("grant_type", "authorization_code");
    params.append("client_id", process.env.HUBSPOT_CLIENT_ID);
    params.append("client_secret", process.env.HUBSPOT_CLIENT_SECRET);
    params.append("redirect_uri", process.env.HUBSPOT_REDIRECT_URI);
    params.append("code", code);

    const response = await require("axios").post("https://api.hubapi.com/oauth/v1/token", params, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    const data = response.data;
    const expiresAt = new Date(Date.now() + data.expires_in * 1000);

    await User.findOneAndUpdate(
      { crmUserId },
      {
        crmUserId,
        hubspotIntegration: {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          hubId: data.hub_id,
          expiresAt,
          connectedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    console.log("✅ HubSpot connected for user:", crmUserId);
    res.send("✅ HubSpot successfully connected.");
  } catch (err) {
    console.error("❌ OAuth error:", err.response?.data || err.message);
    res.status(500).send("OAuth flow failed");
  }
});

// Webhook handler
app.post("/api/hubspot/webhook", async (req, res) => {
  const portalId = req.headers["x-hubspot-hub-id"];
  const signature = req.headers["x-hubspot-signature"];
  const payload = req.body;

  const nowIST = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: true,
  });

  console.log(`\n🟢 Webhook received @ ${nowIST}`);
  console.log(`🔐 Portal ID: ${portalId}`);
  console.log(`🔐 Signature: ${signature}`);
  console.dir(payload, { depth: null });

  const hubId = Number(portalId);
  if (isNaN(hubId)) {
    console.error("❌ Invalid hubId:", portalId);
    return res.status(400).send("Invalid HubSpot portal ID");
  }

  const user = await User.findOne({ "hubspotIntegration.hubId": hubId });
  if (!user) {
    console.warn("⚠️ No CRM user found for portal ID:", hubId);
    return res.status(404).send("Unknown HubSpot portal");
  }

  const accessToken = user.hubspotIntegration.accessToken;

  if (Array.isArray(payload)) {
    for (const [index, event] of payload.entries()) {
      const utcDate = new Date(Number(event.occurredAt));
      const istDate = utcDate.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour12: true,
      });

      console.log(`\n🔔 Event #${index + 1}`);
      console.log(`📌 Type: ${event.subscriptionType}`);
      console.log(`📌 Object ID: ${event.objectId}`);
      console.log(`📆 UTC: ${utcDate.toISOString()} | IST: ${istDate}`);

      if (event.subscriptionType === "contact.creation") {
        try {
          const contact = await fetchContactDetails(hubId, accessToken, event.objectId);
          console.log("📄 Contact Details:");
          console.dir(contact, { depth: null });
        } catch (err) {
          console.error(`❌ Failed to fetch contact ${event.objectId}:`, err.message);
        }
      }
    }
  } else {
    console.warn("⚠️ Unexpected webhook format:", payload);
  }

  res.status(200).send("Webhook received");
});

// Test user creation
app.post("/api/test/add-user", async (req, res) => {
  try {
    const user = await User.create({});
    return res.json({ success: true, user });
  } catch (err) {
    console.error("❌ Error adding user:", err);
    return res.status(500).send("Failed to add user");
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
