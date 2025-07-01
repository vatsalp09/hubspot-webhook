// models/hubspotIntegration.model.js
const mongoose = require('mongoose');

const HubspotIntegrationSchema = new mongoose.Schema({
  crmUserId: String, // your internal CRM user ID
  hubId: Number,     // from HubSpot
  accessToken: String,
  refreshToken: String,
  expiresAt: Date,
}, { timestamps: true });

module.exports = mongoose.model('HubspotIntegration', HubspotIntegrationSchema);
