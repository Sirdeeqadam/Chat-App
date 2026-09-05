const nodemailer = require("nodemailer");
const dns = require("dns");

if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

const getEmailUser = () =>
  process.env.SMTP_USER ||
  process.env.NODE_CODE_SENDING_EMAIL_ADDRESS ||
  process.env.EMAIL_USER ||
  "";

const getEmailPassword = () =>
  String(
    process.env.SMTP_PASS ||
      process.env.NODE_CODE_SENDING_EMAIL_PASSWORD ||
      process.env.EMAIL_PASS ||
      ""
  ).replace(/\s+/g, "");

const getSmtpHost = () => process.env.SMTP_HOST || "smtp.gmail.com";
const getSmtpPort = () => Number(process.env.SMTP_PORT) || 465;
const getSmtpSecure = () =>
  String(process.env.SMTP_SECURE ?? "true").toLowerCase() === "true";
const getSmtpFrom = () =>
  process.env.SMTP_FROM || `"Multilingual Chat" <${getEmailUser()}>`;

const hasSmtpConfig = () => Boolean(getEmailUser() && getEmailPassword());

const sendSmtpEmail = async ({ to, subject, text, html }) => {
  if (!hasSmtpConfig()) {
    throw new Error("Gmail SMTP configuration is missing.");
  }

  const host = getSmtpHost();
  const info = await nodemailer.createTransport({
    host,
    port: getSmtpPort(),
    secure: getSmtpSecure(),
    auth: { user: getEmailUser(), pass: getEmailPassword() },
    family: 4,
    tls: { servername: host },
    connectionTimeout: 10000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
  }).sendMail({ from: getSmtpFrom(), to, subject, text, html });

  console.log("[Gmail SMTP Email Sent]", info.messageId);
  return info;
};

const sendPasswordResetEmail = async ({
  recipient,
  resetUrl,
  expiresInMinutes,
}) => {
  await sendSmtpEmail({
    to: recipient,
    subject: "Reset your Multilingual password",
    text: [
      "We received a request to reset your Multilingual password.",
      "",
      `Reset your password: ${resetUrl}`,
      "",
      `This link expires in ${expiresInMinutes} minutes.`,
      "If you did not request this, you can ignore this email.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#172033">
        <h2 style="color:#2563eb">Reset your Multilingual password</h2>
        <p>We received a request to reset your password.</p>
        <p><a href="${resetUrl}" style="display:inline-block;padding:12px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px">Reset password</a></p>
        <p>This link expires in ${expiresInMinutes} minutes.</p>
        <p>If you did not request this, you can ignore this email.</p>
      </div>
    `,
  });

  return true;
};

const sendPasswordResetOtp = async ({
  recipient,
  otp,
  expiresInMinutes,
}) => {
  await sendSmtpEmail({
    to: recipient,
    subject: "Your Multilingual password reset code",
    text: `Your Multilingual password reset code is ${otp}. It expires in ${expiresInMinutes} minutes.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#172033"><h2 style="color:#2563eb">Password reset code</h2><p>Your Chat verification code is:</p><p style="font-size:32px;font-weight:700;letter-spacing:8px;color:#2563eb">${otp}</p><p>This code expires in ${expiresInMinutes} minutes.</p><p>If you did not request this, you can ignore this email.</p></div>`,
  });

  return true;
};

module.exports = {
  hasSmtpConfig,
  sendPasswordResetEmail,
  sendPasswordResetOtp,
};