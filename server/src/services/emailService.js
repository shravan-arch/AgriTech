import nodemailer from 'nodemailer';

let customTransporter = null;

/**
 * Configure or inject a custom transporter (useful for tests).
 */
export const setCustomTransporter = (transporter) => {
  customTransporter = transporter;
};

/**
 * Creates or retrieves the Nodemailer transporter based on environment config.
 */
export const getTransporter = () => {
  if (customTransporter) {
    return customTransporter;
  }

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });
};

const getClientUrl = () => {
  if (process.env.CLIENT_URL) return process.env.CLIENT_URL.replace(/\/+$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:5173';
};

/**
 * Sends a password reset email.
 *
 * @param {object} params
 * @param {string} params.to - Recipient email.
 * @param {string} params.name - User's name.
 * @param {string} params.resetToken - Raw cryptographically secure reset token.
 * @returns {Promise<boolean>} Resolves true on successful dispatch.
 * @throws {Error} Throws if delivery fails or transporter is unconfigured.
 */
export const sendPasswordResetEmail = async ({ to, name, resetToken }) => {
  const clientUrl = getClientUrl();
  const resetUrl = `${clientUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;
  const from = process.env.EMAIL_FROM || '"AgriTech Security" <no-reply@agritech.local>';

  const transporter = getTransporter();

  if (!transporter) {
    const error = new Error('Email service is not configured (SMTP_HOST missing).');
    error.code = 'EMAIL_NOT_CONFIGURED';
    throw error;
  }

  const mailOptions = {
    from,
    to,
    subject: 'Reset your AgriTech password',
    text: `Hello ${name || 'Farmer'},\n\nA password reset request was made for your AgriTech account.\n\nTo reset your password, visit the following link (valid for 1 hour):\n${resetUrl}\n\nIf you did not request this, please disregard this email and your password will remain unchanged.\n\nSincerely,\nThe AgriTech Team`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1f2937;">
        <div style="display: flex; align-items: center; margin-bottom: 24px;">
          <h2 style="color: #2d5a27; margin: 0; font-size: 22px;">AgriTech</h2>
        </div>
        <p style="font-size: 16px; line-height: 1.5;">Hello ${name ? name : 'Farmer'},</p>
        <p style="font-size: 15px; line-height: 1.5; color: #4b5563;">
          We received a request to reset your password for your AgriTech account.
        </p>
        <div style="margin: 32px 0;">
          <a href="${resetUrl}" style="background-color: #2d5a27; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p style="font-size: 13px; line-height: 1.5; color: #6b7280;">
          This link will expire in <strong>1 hour</strong>. If the button above does not work, copy and paste this link into your browser:
        </p>
        <p style="font-size: 12px; color: #4b5563; word-break: break-all;">
          ${resetUrl}
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 28px 0;" />
        <p style="font-size: 12px; color: #9ca3af; line-height: 1.4;">
          If you did not request a password reset, you can safely ignore this email. Your account is still secure.
        </p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (deliveryError) {
    const error = new Error(`Email delivery failed: ${deliveryError.message}`);
    error.cause = deliveryError;
    throw error;
  }
};

/**
 * Sends an email verification link to activate a newly registered account.
 *
 * @param {object} params
 * @param {string} params.to - Recipient email.
 * @param {string} params.name - User's name.
 * @param {string} params.verificationToken - Raw cryptographically secure verification token.
 * @returns {Promise<boolean>} Resolves true on successful dispatch.
 * @throws {Error} Throws if delivery fails or transporter is unconfigured.
 */
export const sendVerificationEmail = async ({ to, name, verificationToken }) => {
  const clientUrl = getClientUrl();
  const verificationUrl = `${clientUrl}/verify-email?token=${encodeURIComponent(verificationToken)}`;
  const from = process.env.EMAIL_FROM || '"AgriTech Security" <no-reply@agritech.local>';

  const transporter = getTransporter();

  if (!transporter) {
    const error = new Error('Email service is not configured (SMTP_HOST missing).');
    error.code = 'EMAIL_NOT_CONFIGURED';
    throw error;
  }

  const mailOptions = {
    from,
    to,
    subject: 'Verify your AgriTech email address',
    text: `Hello ${name || 'Farmer'},\n\nThank you for creating an account with AgriTech.\n\nTo verify your email address and activate your account, please visit the following link (valid for 24 hours):\n${verificationUrl}\n\nIf you did not register for an AgriTech account, you can safely ignore this email.\n\nSincerely,\nThe AgriTech Team`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1f2937;">
        <div style="display: flex; align-items: center; margin-bottom: 24px;">
          <h2 style="color: #2d5a27; margin: 0; font-size: 22px;">AgriTech</h2>
        </div>
        <p style="font-size: 16px; line-height: 1.5;">Hello ${name ? name : 'Farmer'},</p>
        <p style="font-size: 15px; line-height: 1.5; color: #4b5563;">
          Thank you for joining AgriTech. Please verify your email address to activate your farm management portal.
        </p>
        <div style="margin: 32px 0;">
          <a href="${verificationUrl}" style="background-color: #2d5a27; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">
            Verify Email Address
          </a>
        </div>
        <p style="font-size: 13px; line-height: 1.5; color: #6b7280;">
          This verification link will expire in <strong>24 hours</strong>. If the button above does not work, copy and paste this link into your browser:
        </p>
        <p style="font-size: 12px; color: #4b5563; word-break: break-all;">
          ${verificationUrl}
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 28px 0;" />
        <p style="font-size: 12px; color: #9ca3af; line-height: 1.4;">
          If you did not create an account on AgriTech, you can safely ignore this email.
        </p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (deliveryError) {
    const error = new Error(`Email delivery failed: ${deliveryError.message}`);
    error.cause = deliveryError;
    throw error;
  }
};

export default {
  getTransporter,
  setCustomTransporter,
  sendPasswordResetEmail,
  sendVerificationEmail,
};
