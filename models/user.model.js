// models/user.model.js

const mongoose = require("mongoose");

const hubspotIntegrationSchema = new mongoose.Schema({
  accessToken: String,
  refreshToken: String,
  hubId: Number,
  expiresAt: Date,
  connectedAt: Date,
});

const userSchema = new mongoose.Schema(
  {
    crmUserId: {
      type: mongoose.Schema.Types.ObjectId, // 🔹 preferred format
      required: true,
      unique: true,
      auto: true, // optional: auto-generate ObjectId
    },
    hubspotIntegration: {
      type: hubspotIntegrationSchema,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
