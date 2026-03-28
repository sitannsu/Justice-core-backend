const nodemailer = require('nodemailer');
const crypto = require('crypto');

class EmailService {
  constructor() {
    this.transporter = null;
  }

  getTransporter() {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER_GMAIL || 'docket.digital2025@gmail.com',
          pass: process.env.EMAIL_PASS_GMAIL || 'wtme miaf qnwm ghed'
        }
      });
    }
    return this.transporter;
  }

  async sendEmail(options) {
    try {
      const transporter = this.getTransporter();
      const mailOptions = {
        from: process.env.EMAIL_FROM_GMAIL || 'docket.digital2025@gmail.com',
        to: options.to,
        subject: options.subject,
        html: options.html
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', info.messageId);
      return true;
    } catch (error) {
      console.error('Email sending failed:', error);
      return false;
    }
  }

  generateVerificationToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  async sendVerificationEmail(email, token, firstName) {
    const backendUrl = process.env.BACKEND_URL || 'https://api.docket.digital';
    const verificationUrl = `${backendUrl}/api/auth/verify/${token}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Email Verification</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2c3e50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f8f9fa; }
          .button { display: inline-block; padding: 12px 24px; background-color: #3498db; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Docket Digital</h1>
          </div>
          <div class="content">
            <h2>Hello ${firstName}!</h2>
            <p>Thank you for registering with Docket Digital. To complete your registration, please verify your email address by clicking the button below:</p>
            <a href="${verificationUrl}" class="button">Verify Email Address</a>
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p>${verificationUrl}</p>
            <p>This verification link will expire in 24 hours.</p>
            <p>If you didn't create an account with us, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 Docket Digital. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: 'Verify Your Email - Docket Digital',
      html
    });
  }

  async sendLoginNotificationEmail(email, firstName, loginTime, ipAddress) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Login Notification</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #27ae60; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f8f9fa; }
          .alert { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Login Notification</h1>
          </div>
          <div class="content">
            <h2>Hello ${firstName}!</h2>
            <p>We detected a new login to your Docket Digital account.</p>
            <div class="alert">
              <strong>Login Details:</strong><br>
              Time: ${loginTime.toLocaleString()}<br>
              ${ipAddress ? `IP Address: ${ipAddress}<br>` : ''}
            </div>
            <p>If this was you, you can safely ignore this email.</p>
            <p>If you didn't log in to your account, please contact our support team immediately.</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 Docket Digital. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: 'New Login Detected - Docket Digital',
      html
    });
  }
}

module.exports = {
  emailService: new EmailService()
};
