const cron = require('node-cron');
const { pool } = require('../config/database');
const { checkSSLCertificate } = require('./sslService');
const { 
  sendDomainExpiryAlert, 
  sendSSLExpiryAlert, 
  sendDomainDowntimeAlert 
} = require('./notificationService');

// Daily monitoring job - runs at 9 AM every day
const dailyMonitoringJob = cron.schedule('0 9 * * *', async () => {
  console.log('Starting daily monitoring job...');
  await performDailyMonitoring();
}, {
  scheduled: false,
  timezone: "UTC"
});

// SSL monitoring job - runs every 6 hours
const sslMonitoringJob = cron.schedule('0 */6 * * *', async () => {
  console.log('Starting SSL monitoring job...');
  await performSSLMonitoring();
}, {
  scheduled: false,
  timezone: "UTC"
});

// Domain uptime monitoring job - runs every 30 minutes
const uptimeMonitoringJob = cron.schedule('*/30 * * * *', async () => {
  console.log('Starting uptime monitoring job...');
  await performUptimeMonitoring();
}, {
  scheduled: false,
  timezone: "UTC"
});

// Alert checking job - runs every hour
const alertCheckingJob = cron.schedule('0 * * * *', async () => {
  console.log('Starting alert checking job...');
  await checkAndSendAlerts();
}, {
  scheduled: false,
  timezone: "UTC"
});

async function performDailyMonitoring() {
  try {
    // Get all active domains
    const domainsResult = await pool.query(`
      SELECT d.*, u.email, u.first_name, u.last_name, u.phone
      FROM domains d
      JOIN users u ON d.user_id = u.id
      WHERE d.status = 'active'
    `);

    for (const domain of domainsResult.rows) {
      try {
        // Check domain expiry
        const daysUntilExpiry = Math.ceil((new Date(domain.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
        
        if (daysUntilExpiry <= 30 && daysUntilExpiry > 0) {
          // Check if alert should be sent
          const alertResult = await pool.query(`
            SELECT * FROM alerts 
            WHERE domain_id = $1 AND type = 'domain_expiry' 
            AND days_before_expiry >= $2
          `, [domain.id, daysUntilExpiry]);

          if (alertResult.rows.length > 0) {
            await sendDomainExpiryAlert(domain, domain, daysUntilExpiry);
            
            // Log notification
            await pool.query(`
              INSERT INTO notification_logs (user_id, domain_id, type, method, status, sent_at)
              VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
            `, [domain.user_id, domain.id, 'domain_expiry', 'automated', 'sent']);
          }
        }

        // Update domain status if expired
        if (daysUntilExpiry <= 0) {
          await pool.query(`
            UPDATE domains SET status = 'expired', updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
          `, [domain.id]);
        }
      } catch (error) {
        console.error(`Error monitoring domain ${domain.domain_name}:`, error);
      }
    }
  } catch (error) {
    console.error('Daily monitoring error:', error);
  }
}

async function performSSLMonitoring() {
  try {
    // Get domains with SSL certificates
    const sslResult = await pool.query(`
      SELECT 
        d.*, s.*, u.email, u.first_name, u.last_name, u.phone
      FROM domains d
      JOIN ssl_certificates s ON d.id = s.domain_id
      JOIN users u ON d.user_id = u.id
      WHERE d.status = 'active'
    `);

    for (const record of sslResult.rows) {
      try {
        // Check SSL certificate
        const sslInfo = await checkSSLCertificate(record.domain_name);
        
        if (sslInfo) {
          // Update SSL certificate info
          await pool.query(`
            UPDATE ssl_certificates 
            SET 
              issuer = $1,
              valid_from = $2,
              valid_until = $3,
              status = $4,
              last_checked = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
            WHERE domain_id = $5
          `, [
            sslInfo.issuer,
            sslInfo.validFrom,
            sslInfo.validUntil,
            sslInfo.status,
            record.domain_id
          ]);

          // Check for SSL expiry alerts
          const daysUntilSSLExpiry = Math.ceil((new Date(sslInfo.validUntil) - new Date()) / (1000 * 60 * 60 * 24));
          
          if (daysUntilSSLExpiry <= 30 && daysUntilSSLExpiry > 0) {
            const alertResult = await pool.query(`
              SELECT * FROM alerts 
              WHERE domain_id = $1 AND type = 'ssl_expiry' 
              AND days_before_expiry >= $2
            `, [record.domain_id, daysUntilSSLExpiry]);

            if (alertResult.rows.length > 0) {
              await sendSSLExpiryAlert(record, record, daysUntilSSLExpiry);
              
              // Log notification
              await pool.query(`
                INSERT INTO notification_logs (user_id, domain_id, type, method, status, sent_at)
                VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
              `, [record.user_id, record.domain_id, 'ssl_expiry', 'automated', 'sent']);
            }
          }
        }
      } catch (error) {
        console.error(`Error monitoring SSL for domain ${record.domain_name}:`, error);
      }
    }
  } catch (error) {
    console.error('SSL monitoring error:', error);
  }
}

async function performUptimeMonitoring() {
  try {
    // Get active domains for uptime monitoring
    const domainsResult = await pool.query(`
      SELECT d.*, u.email, u.first_name, u.last_name, u.phone
      FROM domains d
      JOIN users u ON d.user_id = u.id
      WHERE d.status = 'active'
    `);

    for (const domain of domainsResult.rows) {
      try {
        // Simple HTTP check for domain availability
        const isUp = await checkDomainUptime(domain.domain_name);
        
        if (!isUp) {
          // Check if downtime alert should be sent
          const alertResult = await pool.query(`
            SELECT * FROM alerts 
            WHERE domain_id = $1 AND type = 'domain_downtime'
          `, [domain.id]);

          if (alertResult.rows.length > 0) {
            await sendDomainDowntimeAlert(domain, domain, 'Domain appears to be down');
            
            // Log notification
            await pool.query(`
              INSERT INTO notification_logs (user_id, domain_id, type, method, status, sent_at)
              VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
            `, [domain.user_id, domain.id, 'domain_downtime', 'automated', 'sent']);
          }
        }
      } catch (error) {
        console.error(`Error checking uptime for domain ${domain.domain_name}:`, error);
      }
    }
  } catch (error) {
    console.error('Uptime monitoring error:', error);
  }
}

async function checkDomainUptime(domainName) {
  return new Promise((resolve) => {
    const https = require('https');
    const http = require('http');
    
    const url = domainName.startsWith('http') ? domainName : `https://${domainName}`;
    const protocol = url.startsWith('https') ? https : http;
    
    const req = protocol.get(url, { timeout: 10000 }, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 400);
    });
    
    req.on('error', () => {
      resolve(false);
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function checkAndSendAlerts() {
  try {
    // Check for domain expiry alerts
    const expiringDomains = await pool.query(`
      SELECT 
        d.*, u.email, u.first_name, u.last_name, u.phone,
        a.days_before_expiry, a.email_enabled, a.sms_enabled
      FROM domains d
      JOIN users u ON d.user_id = u.id
      JOIN alerts a ON d.id = a.domain_id
      WHERE a.type = 'domain_expiry' 
        AND d.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
        AND d.expiry_date > CURRENT_DATE
        AND d.status = 'active'
    `);

    for (const record of expiringDomains.rows) {
      const daysUntilExpiry = Math.ceil((new Date(record.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilExpiry <= record.days_before_expiry) {
        // Check if notification was already sent recently
        const recentNotification = await pool.query(`
          SELECT id FROM notification_logs 
          WHERE domain_id = $1 AND type = 'domain_expiry' 
          AND sent_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'
        `, [record.id]);

        if (recentNotification.rows.length === 0) {
          await sendDomainExpiryAlert(record, record, daysUntilExpiry);
          
          // Log notification
          await pool.query(`
            INSERT INTO notification_logs (user_id, domain_id, type, method, status, sent_at)
            VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
          `, [record.user_id, record.id, 'domain_expiry', 'automated', 'sent']);
        }
      }
    }

    // Check for SSL expiry alerts
    const expiringSSL = await pool.query(`
      SELECT 
        d.*, s.*, u.email, u.first_name, u.last_name, u.phone,
        a.days_before_expiry, a.email_enabled, a.sms_enabled
      FROM domains d
      JOIN ssl_certificates s ON d.id = s.domain_id
      JOIN users u ON d.user_id = u.id
      JOIN alerts a ON d.id = a.domain_id
      WHERE a.type = 'ssl_expiry' 
        AND s.valid_until <= CURRENT_DATE + INTERVAL '30 days'
        AND s.valid_until > CURRENT_DATE
        AND d.status = 'active'
    `);

    for (const record of expiringSSL.rows) {
      const daysUntilSSLExpiry = Math.ceil((new Date(record.valid_until) - new Date()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilSSLExpiry <= record.days_before_expiry) {
        // Check if notification was already sent recently
        const recentNotification = await pool.query(`
          SELECT id FROM notification_logs 
          WHERE domain_id = $1 AND type = 'ssl_expiry' 
          AND sent_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'
        `, [record.id]);

        if (recentNotification.rows.length === 0) {
          await sendSSLExpiryAlert(record, record, daysUntilSSLExpiry);
          
          // Log notification
          await pool.query(`
            INSERT INTO notification_logs (user_id, domain_id, type, method, status, sent_at)
            VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
          `, [record.user_id, record.id, 'ssl_expiry', 'automated', 'sent']);
        }
      }
    }
  } catch (error) {
    console.error('Alert checking error:', error);
  }
}

function startMonitoring() {
  console.log('Starting monitoring services...');
  
  // Start all monitoring jobs
  dailyMonitoringJob.start();
  sslMonitoringJob.start();
  uptimeMonitoringJob.start();
  alertCheckingJob.start();
  
  console.log('Monitoring services started successfully');
}

function stopMonitoring() {
  console.log('Stopping monitoring services...');
  
  // Stop all monitoring jobs
  dailyMonitoringJob.stop();
  sslMonitoringJob.stop();
  uptimeMonitoringJob.stop();
  alertCheckingJob.stop();
  
  console.log('Monitoring services stopped successfully');
}

module.exports = {
  startMonitoring,
  stopMonitoring,
  performDailyMonitoring,
  performSSLMonitoring,
  performUptimeMonitoring,
  checkAndSendAlerts
}; 