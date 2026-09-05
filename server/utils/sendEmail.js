const nodemailer = require("nodemailer");
const dns = require("dns");

if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

const emailUser = process.env.SMTP_USER || process.env.NODE_CODE_SENDING_EMAIL_ADDRESS || process.env.EMAIL_USER;
const emailPass = String(process.env.SMTP_PASS || process.env.NODE_CODE_SENDING_EMAIL_PASSWORD || process.env.EMAIL_PASS || "").replace(/\s+/g, "");
const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
const smtpPort = Number(process.env.SMTP_PORT) || 465;
const smtpSecure = String(process.env.SMTP_SECURE ?? "true").toLowerCase() === "true";
const emailFrom = process.env.SMTP_FROM || `"Multilingual Chat" <${emailUser}>`;

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpSecure,
  auth: { user: emailUser, pass: emailPass },
  family: 4,
  tls: { servername: smtpHost },
  connectionTimeout: 10000,
  greetingTimeout: 5000,
  socketTimeout: 10000,
});

const sendEmail = async ({ to, subject, html, text }) => {
  const info = await transporter.sendMail({ from: emailFrom, to, subject, text, html });
  console.log("[Gmail SMTP Email Sent]", info.messageId);
  return info;
};

module.exports = { sendEmail };