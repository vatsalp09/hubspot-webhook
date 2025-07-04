const axios = require("axios");

/**
 * Refresh HubSpot access token using a refresh token.
 * @param {string} refreshToken - Stored refresh token.
 * @returns {object} New tokens and expiry.
 */
async function refreshAccessToken(refreshToken) {
  try {
    const params = new URLSearchParams();
    params.append("grant_type", "refresh_token");
    params.append("client_id", process.env.HUBSPOT_CLIENT_ID);
    params.append("client_secret", process.env.HUBSPOT_CLIENT_SECRET);
    params.append("refresh_token", refreshToken);

    const response = await axios.post(
      "https://api.hubapi.com/oauth/v1/token",
      params,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const data = response.data;
    const newExpiresAt = new Date(Date.now() + data.expires_in * 1000);

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken, // sometimes it doesn't rotate
      expiresAt: newExpiresAt,
      hubId: data.hub_id,
    };
  } catch (err) {
    console.error("❌ Failed to refresh token:", err.response?.data || err.message);
    throw new Error("Failed to refresh HubSpot access token.");
  }
}

module.exports = refreshAccessToken;
