const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.gmail.com",
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: false, // true for 465, false for 587
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Verify connection configuration
transporter.verify((error, success) => {
  if (error) {
    console.error("[Nodemailer Config Error]", error.message);
  } else {
    console.log("[Nodemailer] Transporter is ready to dispatch emails");
  }
});

exports.sendEmail = async ({ to, subject, html, text }) => {
  try {
    const info = await transporter.sendMail({
      from: `"Your App Name" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html,
    });
    console.log("[Email Sent]", info.messageId);
    return info;
  } catch (error) {
    console.error(`[Email Failure] Failed to send email to ${to}:`, error.message);
  }
};