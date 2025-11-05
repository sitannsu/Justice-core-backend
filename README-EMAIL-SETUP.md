# Email Setup for Client Login Credentials

## Overview
When a lawyer adds a new client, the system automatically sends an email to the client with their login credentials.

## Setup Steps

### 1. Install Nodemailer
```bash
cd Justice-core-backend
npm install nodemailer
```

### 2. Configure Environment Variables
Add these to your `.env` file:

```env
# Email Configuration
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
FRONTEND_URL=http://localhost:3000

# JWT Secret (if not already set)
JWT_SECRET=your-secret-key
```

### 3. Gmail Setup (Recommended)
1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate App Password**:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a password for "Mail"
   - Use this password in `EMAIL_PASSWORD`

### 4. Alternative Email Services
You can modify the transporter configuration in `routes/client.js`:

```javascript
// For Outlook/Hotmail
const transporter = nodemailer.createTransporter({
  service: 'outlook',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// For custom SMTP
const transporter = nodemailer.createTransporter({
  host: 'smtp.your-provider.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});
```

## How It Works

1. **Lawyer adds client** with any email address
2. **System checks** if email already exists
3. **If new email**: Creates client account with password "Password123"
4. **Sends email** with login credentials to the client
5. **Client can login** using their email + "Password123"

## Email Template
The email includes:
- Welcome message
- Login credentials (email + password)
- Login link to the client portal
- Security reminder to change password

## Testing
1. Add a new client with a valid email
2. Check the email was sent
3. Verify the client can login with the credentials

## Troubleshooting
- Check console logs for email errors
- Verify environment variables are set
- Ensure email service credentials are correct
- Check if email is in spam folder
