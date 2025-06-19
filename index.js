const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3001;

app.use(bodyParser.json());

// ✅ Root route for health check
app.get('/', (req, res) => {
  res.send('BSS HubSpot Webhook Receiver is running on port 3001.');
});

// ✅ HubSpot Webhook endpoint
app.post('/api/hubspot/webhook', (req, res) => {
  const portalId = req.headers['x-hubspot-hub-id'];
  const signature = req.headers['x-hubspot-signature'];

  // Log when the event was received (current system time in IST)
  const nowIST = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour12: true,
  });

  console.log(`\n🟢 New event received on ${nowIST}`);
  console.log("HubSpot Portal ID:", portalId);
  console.log("Signature:", signature);
  console.log("Event Payload:\n", JSON.stringify(req.body, null, 2));

  if (Array.isArray(req.body)) {
    req.body.forEach(event => {
      const utcDate = new Date(Number(event.occurredAt));
      const istDate = utcDate.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour12: true,
      });

      console.log("📌 Event Type:", event.subscriptionType);
      console.log("📌 Object ID:", event.objectId);
      console.log("📌 Occurred At (UTC):", utcDate.toISOString());
      console.log("📌 Occurred At (IST):", istDate);
    });
  }

  res.status(200).send("Received");
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ BSS HubSpot Webhook Receiver is running at http://localhost:${PORT}`);
});
