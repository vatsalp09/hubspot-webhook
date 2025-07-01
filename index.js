const express = require("express");
const bodyParser = require("body-parser");
const fetch = require("node-fetch");
require("dotenv").config();

const connectDB = require("./db");
const User = require("./models/user.model");
const { generateInstallUrl } = require("./utils/hubspotUtils");

const app = express();
const PORT = process.env.PORT || 3001;

connectDB();
app.use(bodyParser.json());

// ✅ Root route for health check
app.get("/", (req, res) => {
  res.send("BSS HubSpot Webhook Receiver is running on port " + PORT);
});

// ✅ Generate OAuth install URL for a specific CRM user
app.get("/api/hubspot/oauth-url/:crmUserId", (req, res) => {
  const { crmUserId } = req.params;
  if (!crmUserId) return res.status(400).send("Missing crmUserId");

  const installUrl = generateInstallUrl(crmUserId);
  return res.json({ installUrl });
});

// ✅ Handle OAuth callback & store token info
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

    const response = await fetch("https://api.hubapi.com/oauth/v1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });

    const data = await response.json();

    if (data.access_token) {
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
    } else {
      console.error("❌ Token exchange failed:", data);
      res.status(500).json({ error: "Token exchange failed", details: data });
    }
  } catch (err) {
    console.error("❌ OAuth error:", err);
    res.status(500).send("OAuth flow failed");
  }
});

// ✅ Handle HubSpot webhook POST events (e.g., contact creation)
app.post("/api/hubspot/webhook", async (req, res) => {
  const portalId = req.headers["x-hubspot-hub-id"];
  const signature = req.headers["x-hubspot-signature"];

  const nowIST = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: true,
  });

  console.log(`\n🟢 New webhook received on ${nowIST}`);
  console.log("HubSpot Portal ID:", portalId);
  console.log("Signature:", signature);

  const user = await User.findOne({
    "hubspotIntegration.hubId": Number(portalId),
  });

  if (!user) {
    console.warn("⚠️ No CRM user found for portal ID:", portalId);
    return res.status(404).send("Unknown HubSpot portal");
  }

  console.log("👤 CRM User ID:", user.crmUserId);

  if (Array.isArray(req.body)) {
    req.body.forEach((event) => {
      const utcDate = new Date(Number(event.occurredAt));
      const istDate = utcDate.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour12: true,
      });

      console.log("📌 Event Type:", event.subscriptionType);
      console.log("📌 Object ID:", event.objectId);
      console.log("📌 Occurred At (UTC):", utcDate.toISOString());
      console.log("📌 Occurred At (IST):", istDate);
    });
  }

  res.status(200).send("Webhook received");
});

app.post("/api/test/add-user", async (req, res) => {
  try {
    const user = await User.create({}); // no crmUserId needed
    return res.json({ success: true, user });
  } catch (err) {
    console.error("❌ Error adding user:", err);
    return res.status(500).send("Failed to add user");
  }
});

// ✅ Start server
app.listen(PORT, () => {
  console.log(
    `✅ BSS HubSpot Webhook Receiver is running at http://localhost:${PORT}`
  );
});
