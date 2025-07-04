const mongoose = require("mongoose");

const hubspotIntegrationSchema = new mongoose.Schema({
  crmUserId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "User",
    unique: true,
  },
  accessToken: String,
  refreshToken: String,
  hubId: Number,
  expiresAt: Date,
  connectedAt: Date,
}, { timestamps: true });

module.exports = mongoose.model("HubspotIntegration", hubspotIntegrationSchema);
