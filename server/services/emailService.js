const nodemailer = require("nodemailer");

const hasSmtpConfig = () => {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS
  );
};

const getSmtpFrom = () =>
  process.env.SMTP_FROM || process.env.SMTP_USER;

const createTransporter = () => {
  const port = Number(process.env.SMTP_PORT) || 465;
  const isPort465 = port === 465;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: port,
    secure: process.env.SMTP_SECURE !== undefined
      ? String(process.env.SMTP_SECURE).toLowerCase() === "true"
      : isPort465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    // Prevent Render from hanging indefinitely on blocked ports
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 5000,
    socketTimeout: 10000,
  });
};

const sendPasswordResetEmail = async ({
  recipient,
  resetUrl,
  expiresInMinutes,
}) => {
  if (!hasSmtpConfig()) {
    return false;
  }

  const transporter = createTransporter();

  await transporter.sendMail({
    from: getSmtpFrom(),
    to: recipient,
    subject: "Reset your Chat password",
    text: [
      "We received a request to reset your Chat password.",
      "",
      `Reset your password: ${resetUrl}`,
      "",
      `This link expires in ${expiresInMinutes} minutes.`,
      "If you did not request this, you can ignore this email.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#172033">
        <h2 style="color:#2563eb">Reset your Chat password</h2>
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
  if (!hasSmtpConfig()) {
    return false;
  }

  const transporter = createTransporter();

  await transporter.sendMail({
    from: getSmtpFrom(),
    to: recipient,
    subject: "Your Chat password reset code",
    text: `Your Chat password reset code is ${otp}. It expires in ${expiresInMinutes} minutes.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#172033"><h2 style="color:#2563eb">Password reset code</h2><p>Your Chat verification code is:</p><p style="font-size:32px;font-weight:700;letter-spacing:8px;color:#2563eb">${otp}</p><p>This code expires in ${expiresInMinutes} minutes.</p><p>If you did not request this, you can ignore this email.</p></div>`,
  });

  return true;
};

module.exports = {
  hasSmtpConfig,
  sendPasswordResetEmail,
  sendPasswordResetOtp,
};