// Test email configuration
import dotenv from 'dotenv';
import { emailService } from './services/email.service.js';

dotenv.config();

async function testEmail() {
  console.log('Testing email configuration...');
  
  try {
    const result = await emailService.sendEmail({
      to: 'connect@docket.digital',
      subject: 'Test Email Configuration',
      html: `
        <h2>Email Configuration Test</h2>
        <p>This is a test email to verify the Outlook configuration is working correctly.</p>
        <p>Sent at: ${new Date().toLocaleString()}</p>
      `
    });
    
    if (result) {
      console.log('✅ Email sent successfully!');
    } else {
      console.log('❌ Email sending failed');
    }
  } catch (error) {
    console.error('❌ Error testing email:', error);
  }
}

testEmail();