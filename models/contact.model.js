const mongoose = require("mongoose");

const contactSchema = new mongoose.Schema(
  {
    hubId: {
      type: Number,
      required: true,
    },
    crmUserId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    objectId: {
      type: Number,
      required: true,
    },
    email: {
      type: String,
    },
    firstName: {
      type: String,
    },
    lastName: {
      type: String,
    },
    phoneNumber: {
      type: String,
    },
    postalCode: {
      type: String,
    },
    createdAtHubspot: {
      type: Date,
    },
    raw: {
      type: Object, // full raw HubSpot contact object
      default: {},
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Contact", contactSchema);
