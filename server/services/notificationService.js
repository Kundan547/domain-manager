const nodemailer = require('nodemailer');
const twilio = require('twilio');

// Email configuration
const emailTransporter = nodemailer.createTransport({
  service: process.env.SMTP_SERVICE || 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Twilio configuration
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN ? 
  twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN) : null;

async function sendEmailAlert({ to, subject, message, userName }) {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      throw new Error('SMTP configuration not set');
    }

    const mailOptions = {
      from: `"Domain Manager" <${process.env.SMTP_USER}>`,
      to: to,
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">Domain Manager Alert</h1>
          </div>
          <div style="padding: 20px; background: #f9f9f9;">
            <p>Hello ${userName},</p>
            <div style="background: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
              ${message}
            </div>
            <p style="color: #666; font-size: 12px;">
              This is an automated alert from your Domain Manager system.
              <br>
              Please log in to your dashboard to take action.
            </p>
          </div>
          <div style="background: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
            © ${new Date().getFullYear()} Domain Manager. All rights reserved.
          </div>
        </div>
      `
    };

    const info = await emailTransporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return info;
  } catch (error) {
    console.error('Email sending failed:', error);
    throw error;
  }
}

async function sendSMSAlert({ to, message, userName }) {
  try {
    if (!twilioClient) {
      throw new Error('Twilio configuration not set');
    }

    if (!process.env.TWILIO_PHONE_NUMBER) {
      throw new Error('Twilio phone number not configured');
    }

    const smsMessage = await twilioClient.messages.create({
      body: `Domain Manager Alert: ${message}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to
    });

    console.log('SMS sent successfully:', smsMessage.sid);
    return smsMessage;
  } catch (error) {
    console.error('SMS sending failed:', error);
    throw error;
  }
}

async function sendDomainExpiryAlert(domain, user, daysUntilExpiry) {
  const subject = `Domain Expiry Alert - ${domain.domain_name}`;
  const message = `
    <h3>Domain Expiry Warning</h3>
    <p>Your domain <strong>${domain.domain_name}</strong> will expire in <strong>${daysUntilExpiry} days</strong>.</p>
    <p><strong>Expiry Date:</strong> ${new Date(domain.expiry_date).toLocaleDateString()}</p>
    <p><strong>Registrar:</strong> ${domain.registrar || 'Not specified'}</p>
    <p>Please renew your domain to avoid service interruption.</p>
  `;

  const results = [];

  // Send email if user has email
  if (user.email) {
    try {
      await sendEmailAlert({
        to: user.email,
        subject,
        message,
        userName: `${user.first_name} ${user.last_name}`
      });
      results.push({ method: 'email', status: 'success' });
    } catch (error) {
      results.push({ method: 'email', status: 'failed', error: error.message });
    }
  }

  // Send SMS if user has phone
  if (user.phone) {
    try {
      await sendSMSAlert({
        to: user.phone,
        message: `Domain ${domain.domain_name} expires in ${daysUntilExpiry} days`,
        userName: `${user.first_name} ${user.last_name}`
      });
      results.push({ method: 'sms', status: 'success' });
    } catch (error) {
      results.push({ method: 'sms', status: 'failed', error: error.message });
    }
  }

  return results;
}

async function sendSSLExpiryAlert(domain, sslCert, user, daysUntilExpiry) {
  const subject = `SSL Certificate Expiry Alert - ${domain.domain_name}`;
  const message = `
    <h3>SSL Certificate Expiry Warning</h3>
    <p>The SSL certificate for <strong>${domain.domain_name}</strong> will expire in <strong>${daysUntilExpiry} days</strong>.</p>
    <p><strong>Expiry Date:</strong> ${new Date(sslCert.valid_until).toLocaleDateString()}</p>
    <p><strong>Issuer:</strong> ${sslCert.issuer || 'Unknown'}</p>
    <p>Please renew your SSL certificate to maintain secure connections.</p>
  `;

  const results = [];

  // Send email if user has email
  if (user.email) {
    try {
      await sendEmailAlert({
        to: user.email,
        subject,
        message,
        userName: `${user.first_name} ${user.last_name}`
      });
      results.push({ method: 'email', status: 'success' });
    } catch (error) {
      results.push({ method: 'email', status: 'failed', error: error.message });
    }
  }

  // Send SMS if user has phone
  if (user.phone) {
    try {
      await sendSMSAlert({
        to: user.phone,
        message: `SSL certificate for ${domain.domain_name} expires in ${daysUntilExpiry} days`,
        userName: `${user.first_name} ${user.last_name}`
      });
      results.push({ method: 'sms', status: 'success' });
    } catch (error) {
      results.push({ method: 'sms', status: 'failed', error: error.message });
    }
  }

  return results;
}

async function sendDomainDowntimeAlert(domain, user, error) {
  const subject = `Domain Downtime Alert - ${domain.domain_name}`;
  const message = `
    <h3>Domain Downtime Detected</h3>
    <p>Your domain <strong>${domain.domain_name}</strong> appears to be down or unreachable.</p>
    <p><strong>Error:</strong> ${error}</p>
    <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
    <p>Please check your domain's status and take necessary action.</p>
  `;

  const results = [];

  // Send email if user has email
  if (user.email) {
    try {
      await sendEmailAlert({
        to: user.email,
        subject,
        message,
        userName: `${user.first_name} ${user.last_name}`
      });
      results.push({ method: 'email', status: 'success' });
    } catch (error) {
      results.push({ method: 'email', status: 'failed', error: error.message });
    }
  }

  // Send SMS if user has phone
  if (user.phone) {
    try {
      await sendSMSAlert({
        to: user.phone,
        message: `Domain ${domain.domain_name} is down: ${error}`,
        userName: `${user.first_name} ${user.last_name}`
      });
      results.push({ method: 'sms', status: 'success' });
    } catch (error) {
      results.push({ method: 'sms', status: 'failed', error: error.message });
    }
  }

  return results;
}

module.exports = {
  sendEmailAlert,
  sendSMSAlert,
  sendDomainExpiryAlert,
  sendSSLExpiryAlert,
  sendDomainDowntimeAlert
}; 