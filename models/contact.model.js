const mongoose = require("mongoose");

const ContactSchema = new mongoose.Schema({
  hubspotObjectId: { type: String, required: true, unique: true },
  contractorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rawPayload: { type: Object }
}, { timestamps: true });

module.exports = mongoose.model("Contact", ContactSchema);
