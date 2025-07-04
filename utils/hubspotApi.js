const axios = require('axios');

/**
 * Fetches all available contact properties (default + custom) from HubSpot.
 * @param {number} hubId - HubSpot portal ID (not used here but useful for logging).
 * @param {string} accessToken - OAuth access token for the user.
 * @param {string|number} contactId - HubSpot contact ID.
 */
async function fetchContactDetails(hubId, accessToken, contactId) {
  try {
    const url = `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}?archived=false`;

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    console.log("fetchContactDetails", response)
    return response.data; // This contains the full contact object

  } catch (err) {
    const msg = err.response
      ? `HubSpot API error (${err.response.status}): ${JSON.stringify(err.response.data)}`
      : `HubSpot request error: ${err.message}`;
    console.error(`❌ Failed to fetch contact ${contactId} from hub ${hubId}:`, msg);
    throw new Error(msg);
  }
}

module.exports = { fetchContactDetails };
