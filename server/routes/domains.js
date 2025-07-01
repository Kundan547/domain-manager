const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticateToken, auditLog } = require('../middleware/auth');

const router = express.Router();

// Apply authentication and audit logging to all routes
router.use(authenticateToken);
router.use(auditLog);

// Get all domains for user
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        d.*,
        s.issuer as ssl_issuer,
        s.valid_until as ssl_valid_until,
        s.status as ssl_status,
        s.last_checked as ssl_last_checked,
        CASE 
          WHEN d.expiry_date <= CURRENT_DATE THEN 'expired'
          WHEN d.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'
          ELSE 'active'
        END as domain_status,
        CASE 
          WHEN s.valid_until IS NULL THEN 'no_ssl'
          WHEN s.valid_until <= CURRENT_DATE THEN 'ssl_expired'
          WHEN s.valid_until <= CURRENT_DATE + INTERVAL '30 days' THEN 'ssl_expiring_soon'
          ELSE 'ssl_valid'
        END as ssl_health_status
      FROM domains d
      LEFT JOIN ssl_certificates s ON d.id = s.domain_id
      WHERE d.user_id = $1
      ORDER BY d.created_at DESC
    `, [req.user.id]);

    res.json({ domains: result.rows });
  } catch (error) {
    console.error('Get domains error:', error);
    res.status(500).json({ error: 'Failed to fetch domains' });
  }
});

// Get single domain by ID
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        d.*,
        s.issuer as ssl_issuer,
        s.valid_from as ssl_valid_from,
        s.valid_until as ssl_valid_until,
        s.cost as ssl_cost,
        s.purchase_location as ssl_purchase_location,
        s.status as ssl_status,
        s.last_checked as ssl_last_checked
      FROM domains d
      LEFT JOIN ssl_certificates s ON d.id = s.domain_id
      WHERE d.id = $1 AND d.user_id = $2
    `, [req.params.id, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    res.json({ domain: result.rows[0] });
  } catch (error) {
    console.error('Get domain error:', error);
    res.status(500).json({ error: 'Failed to fetch domain' });
  }
});

// Create new domain
router.post('/', [
  body('domainName').trim().notEmpty().isLength({ min: 3 }),
  body('expiryDate').isISO8601(),
  body('registrar').optional().trim(),
  body('purchaseLocation').optional().trim(),
  body('purchaseDate').optional().isISO8601(),
  body('cost').optional().isFloat({ min: 0 }),
  body('notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      domainName,
      registrar,
      purchaseLocation,
      purchaseDate,
      expiryDate,
      cost,
      notes
    } = req.body;

    const result = await pool.query(`
      INSERT INTO domains (
        user_id, domain_name, registrar, purchase_location, 
        purchase_date, expiry_date, cost, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [req.user.id, domainName, registrar, purchaseLocation, 
        purchaseDate, expiryDate, cost, notes]);

    res.status(201).json({
      message: 'Domain created successfully',
      domain: result.rows[0]
    });
  } catch (error) {
    console.error('Create domain error:', error);
    res.status(500).json({ error: 'Failed to create domain' });
  }
});

// Update domain
router.put('/:id', [
  body('domainName').optional().trim().isLength({ min: 3 }),
  body('expiryDate').optional().isISO8601(),
  body('registrar').optional().trim(),
  body('purchaseLocation').optional().trim(),
  body('purchaseDate').optional().isISO8601(),
  body('cost').optional().isFloat({ min: 0 }),
  body('notes').optional().trim(),
  body('status').optional().isIn(['active', 'inactive', 'suspended'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check if domain exists and belongs to user
    const domainCheck = await pool.query(
      'SELECT id FROM domains WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (domainCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    const updateFields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined) {
        const dbField = key === 'domainName' ? 'domain_name' : 
                       key === 'expiryDate' ? 'expiry_date' :
                       key === 'purchaseLocation' ? 'purchase_location' :
                       key === 'purchaseDate' ? 'purchase_date' : key;
        
        updateFields.push(`${dbField} = $${paramCount++}`);
        values.push(req.body[key]);
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.params.id);

    const result = await pool.query(`
      UPDATE domains 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `, values);

    res.json({
      message: 'Domain updated successfully',
      domain: result.rows[0]
    });
  } catch (error) {
    console.error('Update domain error:', error);
    res.status(500).json({ error: 'Failed to update domain' });
  }
});

// Delete domain
router.delete('/:id', async (req, res) => {
  try {
    // Check if domain exists and belongs to user
    const domainCheck = await pool.query(
      'SELECT id FROM domains WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (domainCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    await pool.query('DELETE FROM domains WHERE id = $1', [req.params.id]);

    res.json({ message: 'Domain deleted successfully' });
  } catch (error) {
    console.error('Delete domain error:', error);
    res.status(500).json({ error: 'Failed to delete domain' });
  }
});

// Get domain statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_domains,
        COUNT(CASE WHEN expiry_date <= CURRENT_DATE THEN 1 END) as expired_domains,
        COUNT(CASE WHEN expiry_date <= CURRENT_DATE + INTERVAL '30 days' AND expiry_date > CURRENT_DATE THEN 1 END) as expiring_soon,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_domains,
        SUM(cost) as total_cost
      FROM domains 
      WHERE user_id = $1
    `, [req.user.id]);

    const sslResult = await pool.query(`
      SELECT 
        COUNT(*) as total_ssl,
        COUNT(CASE WHEN s.valid_until <= CURRENT_DATE THEN 1 END) as expired_ssl,
        COUNT(CASE WHEN s.valid_until <= CURRENT_DATE + INTERVAL '30 days' AND s.valid_until > CURRENT_DATE THEN 1 END) as expiring_ssl_soon
      FROM domains d
      LEFT JOIN ssl_certificates s ON d.id = s.domain_id
      WHERE d.user_id = $1 AND s.id IS NOT NULL
    `, [req.user.id]);

    res.json({
      stats: {
        ...result.rows[0],
        ...sslResult.rows[0]
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Get domains expiring soon
router.get('/expiring-soon', async (req, res) => {
  try {
    const days = req.query.days || 30;
    
    const result = await pool.query(`
      SELECT 
        d.*,
        s.valid_until as ssl_valid_until,
        s.status as ssl_status
      FROM domains d
      LEFT JOIN ssl_certificates s ON d.id = s.domain_id
      WHERE d.user_id = $1 
        AND d.expiry_date <= CURRENT_DATE + INTERVAL '${days} days'
        AND d.expiry_date > CURRENT_DATE
      ORDER BY d.expiry_date ASC
    `, [req.user.id]);

    res.json({ domains: result.rows });
  } catch (error) {
    console.error('Get expiring domains error:', error);
    res.status(500).json({ error: 'Failed to fetch expiring domains' });
  }
});

module.exports = router; 