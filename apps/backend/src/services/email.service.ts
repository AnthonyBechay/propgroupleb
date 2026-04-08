import { Resend } from 'resend';

const FROM_EMAIL = process.env.FROM_EMAIL || 'PropGroup <noreply@propgroup.com>';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'invest@propgroup.com';

let resend: Resend | null = null;

function getClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

// ── Welcome Email ──────────────────────────────────────────────────────────

export async function sendWelcomeEmail(to: string, firstName?: string) {
  const client = getClient();
  if (!client) return;

  const name = firstName || 'Investor';

  try {
    await client.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `Welcome to PropGroup, ${name}!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #1B3A5C; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: #C49A2E; margin: 0; font-size: 28px;">PropGroup</h1>
            <p style="color: rgba(255,255,255,0.7); margin: 8px 0 0;">Georgia Real Estate Investment</p>
          </div>
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
            <h2 style="color: #1B3A5C; margin-top: 0;">Welcome, ${name}!</h2>
            <p style="color: #475569; line-height: 1.6;">
              Thank you for joining PropGroup. You now have access to our curated portfolio of premium Georgian real estate investments.
            </p>
            <p style="color: #475569; line-height: 1.6;">Here's what you can do:</p>
            <ul style="color: #475569; line-height: 1.8;">
              <li>Browse 16+ investment properties with verified ROI</li>
              <li>Use AI-powered search to find your perfect match</li>
              <li>Track your investment portfolio</li>
              <li>Get personalized recommendations</li>
            </ul>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'https://propgroup.com'}/properties"
                style="background: #C49A2E; color: #ffffff; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
                Browse Properties
              </a>
            </div>
          </div>
          <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 12px;">
            <p>&copy; ${new Date().getFullYear()} PropGroup. All rights reserved.</p>
          </div>
        </div>
      `,
    });
  } catch (error) {
    console.error('Failed to send welcome email:', error);
  }
}

// ── Password Reset Email ───────────────────────────────────────────────────

export async function sendPasswordResetEmail(to: string, resetToken: string) {
  const client = getClient();
  if (!client) return;

  const resetUrl = `${process.env.FRONTEND_URL || 'https://propgroup.com'}/auth/reset-password?token=${resetToken}`;

  try {
    await client.emails.send({
      from: FROM_EMAIL,
      to,
      subject: 'Reset your password — PropGroup',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #1B3A5C; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: #C49A2E; margin: 0; font-size: 24px;">PropGroup</h1>
          </div>
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
            <h2 style="color: #1B3A5C; margin-top: 0;">Reset Your Password</h2>
            <p style="color: #475569; line-height: 1.6;">
              You requested a password reset. Click the button below to set a new password. This link expires in 1 hour.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}"
                style="background: #C49A2E; color: #ffffff; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
                Reset Password
              </a>
            </div>
            <p style="color: #94a3b8; font-size: 13px; line-height: 1.6;">
              If you didn't request this, you can safely ignore this email.
            </p>
          </div>
          <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 12px;">
            <p>&copy; ${new Date().getFullYear()} PropGroup. All rights reserved.</p>
          </div>
        </div>
      `,
    });
  } catch (error) {
    console.error('Failed to send password reset email:', error);
  }
}

// ── Inquiry Confirmation ───────────────────────────────────────────────────

export async function sendInquiryConfirmation(
  to: string,
  data: { name: string; propertyTitle?: string }
) {
  const client = getClient();
  if (!client) return;

  try {
    await client.emails.send({
      from: FROM_EMAIL,
      to,
      subject: 'We received your inquiry — PropGroup',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #1B3A5C; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: #C49A2E; margin: 0; font-size: 24px;">PropGroup</h1>
          </div>
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
            <h2 style="color: #1B3A5C; margin-top: 0;">Thank you, ${data.name}!</h2>
            <p style="color: #475569; line-height: 1.6;">
              We've received your inquiry${data.propertyTitle ? ` about <strong>${data.propertyTitle}</strong>` : ''}.
              Our investment team will review it and get back to you within 24 hours.
            </p>
            <p style="color: #475569; line-height: 1.6;">
              In the meantime, feel free to browse more properties or use our AI search to discover new opportunities.
            </p>
          </div>
          <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 12px;">
            <p>&copy; ${new Date().getFullYear()} PropGroup. All rights reserved.</p>
          </div>
        </div>
      `,
    });
  } catch (error) {
    console.error('Failed to send inquiry confirmation:', error);
  }
}

// ── Admin Notification ─────────────────────────────────────────────────────

export async function notifyAdminOfInquiry(data: {
  name: string;
  email: string;
  phone?: string;
  message?: string;
  propertyTitle?: string;
}) {
  const client = getClient();
  if (!client) return;

  try {
    await client.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `New inquiry${data.propertyTitle ? `: ${data.propertyTitle}` : ''} — ${data.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #1B3A5C; padding: 24px; border-radius: 12px 12px 0 0;">
            <h1 style="color: #C49A2E; margin: 0; font-size: 20px;">New Inquiry Received</h1>
          </div>
          <div style="background: #ffffff; padding: 24px; border: 1px solid #e2e8f0; border-top: none;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; color: #64748b; width: 120px;">Name:</td><td style="padding: 8px 0; color: #1e293b; font-weight: 600;">${data.name}</td></tr>
              <tr><td style="padding: 8px 0; color: #64748b;">Email:</td><td style="padding: 8px 0; color: #1e293b;">${data.email}</td></tr>
              ${data.phone ? `<tr><td style="padding: 8px 0; color: #64748b;">Phone:</td><td style="padding: 8px 0; color: #1e293b;">${data.phone}</td></tr>` : ''}
              ${data.propertyTitle ? `<tr><td style="padding: 8px 0; color: #64748b;">Property:</td><td style="padding: 8px 0; color: #1e293b;">${data.propertyTitle}</td></tr>` : ''}
              ${data.message ? `<tr><td style="padding: 8px 0; color: #64748b; vertical-align: top;">Message:</td><td style="padding: 8px 0; color: #1e293b;">${data.message}</td></tr>` : ''}
            </table>
            <div style="margin-top: 20px; text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'https://propgroup.com'}/admin/inquiries"
                style="background: #1B3A5C; color: #ffffff; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
                View in Admin
              </a>
            </div>
          </div>
        </div>
      `,
    });
  } catch (error) {
    console.error('Failed to send admin notification:', error);
  }
}

// ── Contact Form Confirmation ──────────────────────────────────────────────

export async function sendContactConfirmation(to: string, name: string) {
  const client = getClient();
  if (!client) return;

  try {
    await client.emails.send({
      from: FROM_EMAIL,
      to,
      subject: 'We received your message — PropGroup',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #1B3A5C; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: #C49A2E; margin: 0; font-size: 24px;">PropGroup</h1>
          </div>
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
            <h2 style="color: #1B3A5C; margin-top: 0;">Thank you, ${name}!</h2>
            <p style="color: #475569; line-height: 1.6;">
              We've received your message and our team will get back to you within 24 hours.
            </p>
          </div>
          <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 12px;">
            <p>&copy; ${new Date().getFullYear()} PropGroup. All rights reserved.</p>
          </div>
        </div>
      `,
    });
  } catch (error) {
    console.error('Failed to send contact confirmation:', error);
  }
}
