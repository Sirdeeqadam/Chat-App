const express = require("express");
const router = express.Router();
const { createGoogleOAuthClient } = require("../services/googleAuth");

// Step 1: Send user to Google
router.get("/google", (req, res) => {
  let oauth2Client;
  try {
    oauth2Client = createGoogleOAuthClient();
  } catch (error) {
    return res.status(503).send(error.message);
  }

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/gmail.send",
    ],
    prompt: "consent",
  });

  res.redirect(authUrl);
});

// Step 2: Google sends the user back here
router.get("/google/callback", async (req, res) => {
  try {
    const oauth2Client = createGoogleOAuthClient();
    const { code } = req.query;

    if (!code) {
      return res.status(400).send("Authorization code missing");
    }

    const { tokens } = await oauth2Client.getToken(code);

    console.log("Google OAuth successful");

    if (!tokens.refresh_token) {
      return res.status(400).send(
        "No refresh token returned. Revoke the previous grant and authorize again."
      );
    }

    return res.type("text").send(
      `Google OAuth successful. Add this value to Render as GOOGLE_REFRESH_TOKEN:\n\n${tokens.refresh_token}`
    );
  } catch (error) {
    console.error("Google OAuth error:", error);
    res.status(500).send("Google authentication failed");
  }
});

module.exports = router;