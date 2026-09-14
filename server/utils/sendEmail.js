const nodemailer = require("nodemailer");
const dns = require("dns");

if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

const emailUser = (
  process.env.SMTP_USER ||
  process.env.NODE_CODE_SENDING_EMAIL_ADDRESS ||
  process.env.EMAIL_USER ||
  ""
).trim();
const emailPass = String(
  process.env.SMTP_PASS ||
  process.env.NODE_CODE_SENDING_EMAIL_PASSWORD ||
  process.env.EMAIL_PASS ||
  ""
).replace(/\s+/g, "");
const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
const smtpPort = Number(process.env.SMTP_PORT) || 465;
const smtpSecure = smtpPort === 465;
const emailFrom = process.env.SMTP_FROM || `"Multilingual Chat" <${emailUser}>`;

const getEmailConfigStatus = () => ({
  configured: Boolean(emailUser && emailPass),
  userConfigured: Boolean(emailUser),
  passwordConfigured: Boolean(emailPass),
  host: smtpHost,
  port: smtpPort,
  secure: smtpSecure,
  fromConfigured: Boolean(emailFrom),
});

const createTransporter = async () => {
  if (!emailUser || !emailPass) {
    throw new Error(
      "SMTP configuration is missing. Set SMTP_USER and SMTP_PASS in the server environment."
    );
  }

  if (![465, 587].includes(smtpPort)) {
    throw new Error("SMTP_PORT must be 465 or 587.");
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: { user: emailUser, pass: emailPass },
    tls: { servername: smtpHost, minVersion: "TLSv1.2" },
    connectionTimeout: 10000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
  });
};

const sendEmail = async ({ to, subject, html, text }) => {
  const transporter = await createTransporter();
  const info = await transporter.sendMail({ from: emailFrom, to, subject, text, html });
  console.log("[Gmail SMTP Email Sent]", info.messageId);
  return info;
};

module.exports = { sendEmail, getEmailConfigStatus };