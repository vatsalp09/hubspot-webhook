const axios = require("axios");

/**
 * Fetches all available contact properties (default + custom) from HubSpot.
 * @param {number} hubId - HubSpot portal ID (not used here but useful for logging).
 * @param {string} accessToken - OAuth access token for the user.
 * @param {string|number} contactId - HubSpot contact ID.
 */
async function fetchContactDetails(hubId, accessToken, contactId) {
  try {
    const desiredProperties = [
      "email",
      "firstname",
      "lastname",
      "phone",
      "zip", // or "postalcode" depending on your portal
      "address", // optional
      "city", // optional
      "state", // optional
      "hs_object_id",
    ];

    const url = `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`;
    const query = new URLSearchParams({
      archived: "false",
      properties: desiredProperties.join(","),
    });

    const fullUrl = `${url}?${query.toString()}`;

    const res = await axios.get(fullUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    const data = res.data;
    const props = data.properties || {};

    return {
      objectId: Number(data.id),
      email: props.email || null,
      firstName: props.firstname || null,
      lastName: props.lastname || null,
      phoneNumber: props.phone || null,
      postalCode: props.zip || props.postalcode || null,
      createdAtHubspot: props.createdate
        ? new Date(props.createdate)
        : new Date(data.createdAt),
      raw: data,
    };
  } catch (err) {
    const msg = err.response
      ? `HubSpot API error (${err.response.status}): ${JSON.stringify(
          err.response.data
        )}`
      : `HubSpot request error: ${err.message}`;
    console.error(
      `❌ Failed to fetch contact ${contactId} from hub ${hubId}:`,
      msg
    );
    throw new Error(msg);
  }
}
/**
 * Fetches details about the connected HubSpot portal.
 * @param {string} accessToken
 */
async function getHubspotAccountDetails(accessToken) {
  const url = `https://api.hubapi.com/integrations/v1/me`;

  const res = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  console.log(res.data);

  return {
    portalId: res.data.portalId,
    userId: res.data.userId,
    hubDomain: res.data.hubDomain,
    scopes: res.data.scopes,
    appId: res.data.appId,
  };
}

module.exports = { fetchContactDetails, getHubspotAccountDetails };
