const { google } = require("googleapis");

const getGoogleOAuthConfig = () => ({
  clientId: String(process.env.GOOGLE_CLIENT_ID || "").trim(),
  clientSecret: String(process.env.GOOGLE_CLIENT_SECRET || "").trim(),
  redirectUri: String(
    process.env.GOOGLE_REDIRECT_URI ||
      "http://localhost:5000/auth/google/callback"
  ).trim(),
});

const createGoogleOAuthClient = () => {
  const { clientId, clientSecret, redirectUri } = getGoogleOAuthConfig();

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Google OAuth configuration is missing. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI."
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
};

module.exports = { createGoogleOAuthClient, getGoogleOAuthConfig };