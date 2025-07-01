const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticateToken, auditLog } = require('../middleware/auth');
const { checkSSLCertificate } = require('../services/sslService');

const router = express.Router();

// Apply authentication and audit logging to all routes
router.use(authenticateToken);
router.use(auditLog);

// Check SSL certificate for a domain
router.post('/check/:domainId', async (req, res) => {
  try {
    // Verify domain belongs to user
    const domainResult = await pool.query(
      'SELECT domain_name FROM domains WHERE id = $1 AND user_id = $2',
      [req.params.domainId, req.user.id]
    );

    if (domainResult.rows.length === 0) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    const domainName = domainResult.rows[0].domain_name;
    
    // Check SSL certificate
    const sslInfo = await checkSSLCertificate(domainName);
    
    if (!sslInfo) {
      return res.status(400).json({ error: 'Could not retrieve SSL certificate information' });
    }

    // Update or insert SSL certificate info
    const upsertResult = await pool.query(`
      INSERT INTO ssl_certificates (
        domain_id, issuer, valid_from, valid_until, cost, purchase_location, status, last_checked
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
      ON CONFLICT (domain_id) 
      DO UPDATE SET 
        issuer = EXCLUDED.issuer,
        valid_from = EXCLUDED.valid_from,
        valid_until = EXCLUDED.valid_until,
        cost = EXCLUDED.cost,
        purchase_location = EXCLUDED.purchase_location,
        status = EXCLUDED.status,
        last_checked = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [
      req.params.domainId,
      sslInfo.issuer,
      sslInfo.validFrom,
      sslInfo.validUntil,
      sslInfo.cost,
      sslInfo.purchaseLocation,
      sslInfo.status
    ]);

    res.json({
      message: 'SSL certificate checked successfully',
      sslInfo: upsertResult.rows[0]
    });
  } catch (error) {
    console.error('SSL check error:', error);
    res.status(500).json({ error: 'Failed to check SSL certificate' });
  }
});

// Get SSL certificate for a domain
router.get('/:domainId', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*, d.domain_name
      FROM ssl_certificates s
      JOIN domains d ON s.domain_id = d.id
      WHERE s.domain_id = $1 AND d.user_id = $2
    `, [req.params.domainId, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'SSL certificate not found' });
    }

    res.json({ sslCertificate: result.rows[0] });
  } catch (error) {
    console.error('Get SSL certificate error:', error);
    res.status(500).json({ error: 'Failed to fetch SSL certificate' });
  }
});

// Update SSL certificate details
router.put('/:domainId', [
  body('issuer').optional().trim(),
  body('validFrom').optional().isISO8601(),
  body('validUntil').optional().isISO8601(),
  body('cost').optional().isFloat({ min: 0 }),
  body('purchaseLocation').optional().trim(),
  body('status').optional().isIn(['valid', 'expired', 'invalid', 'unknown'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Verify domain belongs to user
    const domainCheck = await pool.query(
      'SELECT id FROM domains WHERE id = $1 AND user_id = $2',
      [req.params.domainId, req.user.id]
    );

    if (domainCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    const updateFields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined) {
        const dbField = key === 'validFrom' ? 'valid_from' : 
                       key === 'validUntil' ? 'valid_until' :
                       key === 'purchaseLocation' ? 'purchase_location' : key;
        
        updateFields.push(`${dbField} = $${paramCount++}`);
        values.push(req.body[key]);
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.params.domainId);

    const result = await pool.query(`
      UPDATE ssl_certificates 
      SET ${updateFields.join(', ')}
      WHERE domain_id = $${paramCount}
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'SSL certificate not found' });
    }

    res.json({
      message: 'SSL certificate updated successfully',
      sslCertificate: result.rows[0]
    });
  } catch (error) {
    console.error('Update SSL certificate error:', error);
    res.status(500).json({ error: 'Failed to update SSL certificate' });
  }
});

// Delete SSL certificate
router.delete('/:domainId', async (req, res) => {
  try {
    // Verify domain belongs to user
    const domainCheck = await pool.query(
      'SELECT id FROM domains WHERE id = $1 AND user_id = $2',
      [req.params.domainId, req.user.id]
    );

    if (domainCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    const result = await pool.query(
      'DELETE FROM ssl_certificates WHERE domain_id = $1 RETURNING id',
      [req.params.domainId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'SSL certificate not found' });
    }

    res.json({ message: 'SSL certificate deleted successfully' });
  } catch (error) {
    console.error('Delete SSL certificate error:', error);
    res.status(500).json({ error: 'Failed to delete SSL certificate' });
  }
});

// Get SSL certificates expiring soon
router.get('/expiring-soon', async (req, res) => {
  try {
    const days = req.query.days || 30;
    
    const result = await pool.query(`
      SELECT 
        s.*,
        d.domain_name,
        d.user_id
      FROM ssl_certificates s
      JOIN domains d ON s.domain_id = d.id
      WHERE d.user_id = $1 
        AND s.valid_until <= CURRENT_DATE + INTERVAL '${days} days'
        AND s.valid_until > CURRENT_DATE
      ORDER BY s.valid_until ASC
    `, [req.user.id]);

    res.json({ sslCertificates: result.rows });
  } catch (error) {
    console.error('Get expiring SSL certificates error:', error);
    res.status(500).json({ error: 'Failed to fetch expiring SSL certificates' });
  }
});

// Bulk SSL check for all user domains
router.post('/bulk-check', async (req, res) => {
  try {
    const domainsResult = await pool.query(
      'SELECT id, domain_name FROM domains WHERE user_id = $1',
      [req.user.id]
    );

    const results = [];
    const errors = [];

    for (const domain of domainsResult.rows) {
      try {
        const sslInfo = await checkSSLCertificate(domain.domain_name);
        
        if (sslInfo) {
          // Update SSL certificate info
          await pool.query(`
            INSERT INTO ssl_certificates (
              domain_id, issuer, valid_from, valid_until, cost, purchase_location, status, last_checked
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
            ON CONFLICT (domain_id) 
            DO UPDATE SET 
              issuer = EXCLUDED.issuer,
              valid_from = EXCLUDED.valid_from,
              valid_until = EXCLUDED.valid_until,
              cost = EXCLUDED.cost,
              purchase_location = EXCLUDED.purchase_location,
              status = EXCLUDED.status,
              last_checked = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          `, [
            domain.id,
            sslInfo.issuer,
            sslInfo.validFrom,
            sslInfo.validUntil,
            sslInfo.cost,
            sslInfo.purchaseLocation,
            sslInfo.status
          ]);

          results.push({
            domainId: domain.id,
            domainName: domain.domain_name,
            status: 'success',
            sslInfo
          });
        } else {
          errors.push({
            domainId: domain.id,
            domainName: domain.domain_name,
            error: 'Could not retrieve SSL information'
          });
        }
      } catch (error) {
        errors.push({
          domainId: domain.id,
          domainName: domain.domain_name,
          error: error.message
        });
      }
    }

    res.json({
      message: 'Bulk SSL check completed',
      results,
      errors,
      summary: {
        total: domainsResult.rows.length,
        successful: results.length,
        failed: errors.length
      }
    });
  } catch (error) {
    console.error('Bulk SSL check error:', error);
    res.status(500).json({ error: 'Failed to perform bulk SSL check' });
  }
});

module.exports = router; 