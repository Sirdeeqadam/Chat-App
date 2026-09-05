const nodemailer = require("nodemailer");

const emailUser =
  process.env.SMTP_USER ||
  process.env.NODE_CODE_SENDING_EMAIL_ADDRESS ||
  process.env.EMAIL_USER;
const emailPass =
  process.env.SMTP_PASS ||
  process.env.NODE_CODE_SENDING_EMAIL_PASSWORD ||
  process.env.EMAIL_PASS;
const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT) || 465;
const smtpSecure = String(process.env.SMTP_SECURE || "true").toLowerCase() === "true";
const emailFrom = process.env.SMTP_FROM || `"Multilingual Chat" <${emailUser}>`;

const transporterOptions = {
  ...(smtpHost
    ? {
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
      }
    : { service: "gmail" }),
  auth: {
    user: emailUser,
    pass: emailPass,
  },
  family: 4,
  connectionTimeout: 10000,
  greetingTimeout: 5000,
  socketTimeout: 10000,
};

const transporter = nodemailer.createTransport(transporterOptions);

transporter.verify((error) => {
  if (error) {
    console.error("[Nodemailer Config Error]", error.message);
  } else {
    console.log("[Nodemailer] Transporter is ready to dispatch emails");
  }
});

const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const info = await transporter.sendMail({
      from: emailFrom,
      to,
      subject,
      text,
      html,
    });
    console.log("[Email Sent]", info.messageId);
    return info;
  } catch (error) {
    console.error(`[Email Failure] Failed to send email to ${to}:`, error.message);
    throw error;
  }
};

module.exports = { transporter, sendEmail };