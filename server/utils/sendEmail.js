const { google } = require("googleapis");

const gmailUser = String(process.env.GMAIL_USER || "").trim();
const clientId = String(process.env.GOOGLE_CLIENT_ID || "").trim();
const clientSecret = String(process.env.GOOGLE_CLIENT_SECRET || "").trim();
const refreshToken = String(process.env.GOOGLE_REFRESH_TOKEN || "").trim();
const emailFrom = String(process.env.GMAIL_FROM || `Multilingual Chat <${gmailUser}>`).trim();

const getEmailConfigStatus = () => ({
  provider: "gmail-api",
  configured: Boolean(gmailUser && clientId && clientSecret && refreshToken),
  userConfigured: Boolean(gmailUser),
  clientConfigured: Boolean(clientId && clientSecret),
  refreshTokenConfigured: Boolean(refreshToken),
  fromConfigured: Boolean(emailFrom),
});

const encodeMessage = ({ to, subject, text, html }) => {
  const body = html || text || "";
  const contentType = html ? "text/html; charset=UTF-8" : "text/plain; charset=UTF-8";
  const message = [
    `From: ${emailFrom}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: ${contentType}`,
    "Content-Transfer-Encoding: 8bit",
    "",
    body,
  ].join("\r\n");

  return Buffer.from(message).toString("base64url");
};

const sendEmail = async ({ to, subject, html, text }) => {
  if (!gmailUser || !clientId || !clientSecret || !refreshToken) {
    throw new Error("Gmail API configuration is missing.");
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });
  let response;

  try {
    response = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: encodeMessage({ to, subject, text, html }) },
    });
  } catch (error) {
    const providerError = error.response?.data?.error;
    const details = providerError?.message || error.message;
    const code = providerError?.code || error.code || "unknown";

    console.error(`[Gmail API Email Error] code=${code} message=${details}`);
    throw new Error(`Gmail API email delivery failed (${code}): ${details}`);
  }

  console.log("[Gmail API Email Sent]", response.data.id);
  return { messageId: response.data.id };
};

module.exports = { sendEmail, getEmailConfigStatus };