const nodemailer = require("nodemailer");

const emailUser = process.env.NODE_CODE_SENDING_EMAIL_ADDRESS || process.env.EMAIL_USER;
const emailPass = process.env.NODE_CODE_SENDING_EMAIL_PASSWORD || process.env.EMAIL_PASS;

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: emailUser,
    pass: emailPass,
  },
  family: 4,
  connectionTimeout: 10000,
  greetingTimeout: 5000,
  socketTimeout: 10000,
});

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
      from: `"Multilingual Chat" <${emailUser}>`,
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