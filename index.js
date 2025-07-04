const express = require("express");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const connectDB = require("./db");
const User = require("./models/user.model");
const { generateInstallUrl } = require("./utils/hubspotUtils");
const {
  fetchContactDetails,
  getHubspotAccountDetails,
} = require("./utils/hubspotApi");
const axios = require("axios");
const Contact = require("./models/contact.model");
const refreshAccessToken = require("./utils/refreshAccessToken");

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
    // Exchange code for tokens
    const params = new URLSearchParams();
    params.append("grant_type", "authorization_code");
    params.append("client_id", process.env.HUBSPOT_CLIENT_ID);
    params.append("client_secret", process.env.HUBSPOT_CLIENT_SECRET);
    params.append("redirect_uri", process.env.HUBSPOT_REDIRECT_URI);
    params.append("code", code);

    const response = await axios.post(
      "https://api.hubapi.com/oauth/v1/token",
      params,
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    const { access_token, refresh_token, expires_in } = response.data;

    const expiresAt = new Date(Date.now() + expires_in * 1000);

    // 🔍 Get portal/account details
    const accountDetails = await getHubspotAccountDetails(access_token); // Custom utility

    console.log("🎯 HubSpot Account Details:", accountDetails);

    // 🧠 Save integration info
    await User.findOneAndUpdate(
      { crmUserId },
      {
        crmUserId,
        hubspotIntegration: {
          accessToken: access_token,
          refreshToken: refresh_token,
          hubId: accountDetails.portalId,
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
  const signature = req.headers["x-hubspot-signature"];
  const payload = req.body;
  const portalId = Array.isArray(payload) ? payload[0]?.portalId : undefined;

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
    return res.status(400).json({ message: "Invalid HubSpot portal ID" });
  }

  const user = await User.findOne({ "hubspotIntegration.hubId": hubId });
  if (!user) {
    console.warn("⚠️ No CRM user found for portal ID:", hubId);
    return res.status(404).json({ message: "Unknown HubSpot portal ID" });
  }

  let accessToken = user.hubspotIntegration.accessToken;

  if (new Date() >= new Date(user.hubspotIntegration.expiresAt)) {
    try {
      const refreshed = await refreshAccessToken(
        user.hubspotIntegration.refreshToken
      );
      user.hubspotIntegration.accessToken = refreshed.accessToken;
      user.hubspotIntegration.refreshToken = refreshed.refreshToken;
      user.hubspotIntegration.expiresAt = refreshed.expiresAt;
      await user.save();
      accessToken = refreshed.accessToken;
      console.log("🔁 Access token refreshed");
    } catch (refreshErr) {
      console.error("❌ Failed to refresh access token:", refreshErr.message);
      return res
        .status(401)
        .json({ message: "Failed to refresh HubSpot token" });
    }
  }

  const messages = [];

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

      if (
        event.subscriptionType === "contact.creation" ||
        event.subscriptionType === "contact.propertyChange"
      ) {
        try {
          const contact = await fetchContactDetails(
            hubId,
            accessToken,
            event.objectId
          );
          console.log("📄 Contact Details:");
          console.dir(contact, { depth: null });

          await Contact.findOneAndUpdate(
            { objectId: contact.objectId, hubId },
            {
              ...contact,
              hubId,
              crmUserId: user._id,
            },
            { upsert: true, new: true }
          );

          const typeLabel =
            event.subscriptionType === "contact.creation"
              ? "created"
              : "updated";
          const msg = `✅ Contact ${
            contact.email || contact.objectId
          } ${typeLabel} successfully`;
          console.log(msg);
          messages.push(msg);
        } catch (err) {
          const msg = `❌ Failed to fetch/save contact ${event.objectId}: ${err.message}`;
          console.error(msg);
          messages.push(msg);
        }
      } else {
        const msg = `⚠️ Unsupported subscription type: ${event.subscriptionType}`;
        console.warn(msg);
        messages.push(msg);
      }
    }
  } else {
    const msg = "⚠️ Unexpected webhook format (non-array)";
    console.warn(msg);
    messages.push(msg);
  }

  return res.status(200).json({
    receivedAt: nowIST,
    hubId,
    eventCount: messages.length,
    messages,
  });
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
