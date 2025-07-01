function generateInstallUrl(crmUserId) {
  const clientId = process.env.HUBSPOT_CLIENT_ID;
  const redirectUri = encodeURIComponent(process.env.HUBSPOT_REDIRECT_URI);
  const scopes = encodeURIComponent('crm.objects.contacts.read crm.objects.contacts.write oauth');

  return `https://app.hubspot.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scopes}&state=${crmUserId}`;
}

module.exports = { generateInstallUrl };
