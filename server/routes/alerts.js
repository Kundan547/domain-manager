const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticateToken, auditLog } = require('../middleware/auth');
const { sendEmailAlert, sendSMSAlert } = require('../services/notificationService');

const router = express.Router();

// Apply authentication and audit logging to all routes
router.use(authenticateToken);
router.use(auditLog);

// Get all alerts for user
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        a.*,
        d.domain_name,
        d.expiry_date as domain_expiry_date
      FROM alerts a
      JOIN domains d ON a.domain_id = d.id
      WHERE a.user_id = $1
      ORDER BY a.created_at DESC
    `, [req.user.id]);

    res.json({ alerts: result.rows });
  } catch (error) {
    console.error('Get alerts error:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// Get alerts for a specific domain
router.get('/domain/:domainId', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, d.domain_name
      FROM alerts a
      JOIN domains d ON a.domain_id = d.id
      WHERE a.domain_id = $1 AND a.user_id = $2
    `, [req.params.domainId, req.user.id]);

    res.json({ alerts: result.rows });
  } catch (error) {
    console.error('Get domain alerts error:', error);
    res.status(500).json({ error: 'Failed to fetch domain alerts' });
  }
});

// Create new alert
router.post('/', [
  body('domainId').isInt(),
  body('type').isIn(['domain_expiry', 'ssl_expiry', 'ssl_invalid', 'domain_downtime']),
  body('emailEnabled').optional().isBoolean(),
  body('smsEnabled').optional().isBoolean(),
  body('daysBeforeExpiry').optional().isInt({ min: 1, max: 90 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { domainId, type, emailEnabled = true, smsEnabled = false, daysBeforeExpiry = 30 } = req.body;

    // Verify domain belongs to user
    const domainCheck = await pool.query(
      'SELECT id FROM domains WHERE id = $1 AND user_id = $2',
      [domainId, req.user.id]
    );

    if (domainCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    // Check if alert already exists
    const existingAlert = await pool.query(
      'SELECT id FROM alerts WHERE domain_id = $1 AND type = $2 AND user_id = $3',
      [domainId, type, req.user.id]
    );

    if (existingAlert.rows.length > 0) {
      return res.status(400).json({ error: 'Alert already exists for this domain and type' });
    }

    const result = await pool.query(`
      INSERT INTO alerts (user_id, domain_id, type, email_enabled, sms_enabled, days_before_expiry)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [req.user.id, domainId, type, emailEnabled, smsEnabled, daysBeforeExpiry]);

    res.status(201).json({
      message: 'Alert created successfully',
      alert: result.rows[0]
    });
  } catch (error) {
    console.error('Create alert error:', error);
    res.status(500).json({ error: 'Failed to create alert' });
  }
});

// Update alert
router.put('/:id', [
  body('emailEnabled').optional().isBoolean(),
  body('smsEnabled').optional().isBoolean(),
  body('daysBeforeExpiry').optional().isInt({ min: 1, max: 90 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { emailEnabled, smsEnabled, daysBeforeExpiry } = req.body;

    // Verify alert belongs to user
    const alertCheck = await pool.query(
      'SELECT id FROM alerts WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (alertCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    const updateFields = [];
    const values = [];
    let paramCount = 1;

    if (emailEnabled !== undefined) {
      updateFields.push(`email_enabled = $${paramCount++}`);
      values.push(emailEnabled);
    }
    if (smsEnabled !== undefined) {
      updateFields.push(`sms_enabled = $${paramCount++}`);
      values.push(smsEnabled);
    }
    if (daysBeforeExpiry !== undefined) {
      updateFields.push(`days_before_expiry = $${paramCount++}`);
      values.push(daysBeforeExpiry);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.params.id);

    const result = await pool.query(`
      UPDATE alerts 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `, values);

    res.json({
      message: 'Alert updated successfully',
      alert: result.rows[0]
    });
  } catch (error) {
    console.error('Update alert error:', error);
    res.status(500).json({ error: 'Failed to update alert' });
  }
});

// Delete alert
router.delete('/:id', async (req, res) => {
  try {
    // Verify alert belongs to user
    const alertCheck = await pool.query(
      'SELECT id FROM alerts WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (alertCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    await pool.query('DELETE FROM alerts WHERE id = $1', [req.params.id]);

    res.json({ message: 'Alert deleted successfully' });
  } catch (error) {
    console.error('Delete alert error:', error);
    res.status(500).json({ error: 'Failed to delete alert' });
  }
});

// Test alert notification
router.post('/test/:id', async (req, res) => {
  try {
    // Get alert details
    const alertResult = await pool.query(`
      SELECT a.*, d.domain_name, u.email, u.first_name, u.last_name, u.phone
      FROM alerts a
      JOIN domains d ON a.domain_id = d.id
      JOIN users u ON a.user_id = u.id
      WHERE a.id = $1 AND a.user_id = $2
    `, [req.params.id, req.user.id]);

    if (alertResult.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    const alert = alertResult.rows[0];
    const results = [];

    // Send test email if enabled
    if (alert.email_enabled) {
      try {
        await sendEmailAlert({
          to: alert.email,
          subject: `Test Alert - ${alert.domain_name}`,
          message: `This is a test alert for domain ${alert.domain_name}. Alert type: ${alert.type}`,
          userName: `${alert.first_name} ${alert.last_name}`
        });
        results.push({ method: 'email', status: 'success' });
      } catch (error) {
        results.push({ method: 'email', status: 'failed', error: error.message });
      }
    }

    // Send test SMS if enabled
    if (alert.sms_enabled && alert.phone) {
      try {
        await sendSMSAlert({
          to: alert.phone,
          message: `Test Alert: Domain ${alert.domain_name} - ${alert.type}`,
          userName: `${alert.first_name} ${alert.last_name}`
        });
        results.push({ method: 'sms', status: 'success' });
      } catch (error) {
        results.push({ method: 'sms', status: 'failed', error: error.message });
      }
    }

    // Log test notification
    await pool.query(`
      INSERT INTO notification_logs (user_id, domain_id, type, method, status, sent_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
    `, [req.user.id, alert.domain_id, 'test', 'test', 'sent']);

    res.json({
      message: 'Test notifications sent',
      results
    });
  } catch (error) {
    console.error('Test alert error:', error);
    res.status(500).json({ error: 'Failed to send test notifications' });
  }
});

// Get notification logs
router.get('/logs', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        nl.*,
        d.domain_name,
        u.email
      FROM notification_logs nl
      JOIN domains d ON nl.domain_id = d.id
      JOIN users u ON nl.user_id = u.id
      WHERE nl.user_id = $1
      ORDER BY nl.sent_at DESC
      LIMIT 50
    `, [req.user.id]);

    res.json({ logs: result.rows });
  } catch (error) {
    console.error('Get notification logs error:', error);
    res.status(500).json({ error: 'Failed to fetch notification logs' });
  }
});

// Bulk update alerts for a domain
router.put('/domain/:domainId/bulk', [
  body('alerts').isArray(),
  body('alerts.*.type').isIn(['domain_expiry', 'ssl_expiry', 'ssl_invalid', 'domain_downtime']),
  body('alerts.*.emailEnabled').isBoolean(),
  body('alerts.*.smsEnabled').isBoolean(),
  body('alerts.*.daysBeforeExpiry').isInt({ min: 1, max: 90 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { alerts } = req.body;
    const domainId = req.params.domainId;

    // Verify domain belongs to user
    const domainCheck = await pool.query(
      'SELECT id FROM domains WHERE id = $1 AND user_id = $2',
      [domainId, req.user.id]
    );

    if (domainCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    // Delete existing alerts for this domain
    await pool.query('DELETE FROM alerts WHERE domain_id = $1 AND user_id = $2', [domainId, req.user.id]);

    // Create new alerts
    const createdAlerts = [];
    for (const alert of alerts) {
      const result = await pool.query(`
        INSERT INTO alerts (user_id, domain_id, type, email_enabled, sms_enabled, days_before_expiry)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [req.user.id, domainId, alert.type, alert.emailEnabled, alert.smsEnabled, alert.daysBeforeExpiry]);
      
      createdAlerts.push(result.rows[0]);
    }

    res.json({
      message: 'Alerts updated successfully',
      alerts: createdAlerts
    });
  } catch (error) {
    console.error('Bulk update alerts error:', error);
    res.status(500).json({ error: 'Failed to update alerts' });
  }
});

module.exports = router; 