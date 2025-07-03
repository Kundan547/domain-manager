const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get audit logs for user
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    
    const action = req.query.action;
    const tableName = req.query.table;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    let whereConditions = ['al.user_id = $1'];
    let values = [req.user.id];
    let paramCount = 1;

    if (action) {
      whereConditions.push(`al.action LIKE $${++paramCount}`);
      values.push(`%${action}%`);
    }

    if (tableName) {
      whereConditions.push(`al.table_name = $${++paramCount}`);
      values.push(tableName);
    }

    if (startDate) {
      whereConditions.push(`al.created_at >= $${++paramCount}`);
      values.push(startDate);
    }

    if (endDate) {
      whereConditions.push(`al.created_at <= $${++paramCount}`);
      values.push(endDate);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await pool.query(`
      SELECT COUNT(*) as total
      FROM audit_logs al
      ${whereClause}
    `, values);

    // Get paginated results
    const result = await pool.query(`
      SELECT 
        al.*,
        u.email as user_email,
        u.first_name,
        u.last_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `, [...values, limit, offset]);

    res.json({
      logs: result.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].total),
        totalPages: Math.ceil(countResult.rows[0].total / limit)
      }
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// Get audit logs for a specific domain
router.get('/domain/:domainId', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    // Verify domain belongs to user
    const domainCheck = await pool.query(
      'SELECT id FROM domains WHERE id = $1 AND user_id = $2',
      [req.params.domainId, req.user.id]
    );

    if (domainCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    // Get total count
    const countResult = await pool.query(`
      SELECT COUNT(*) as total
      FROM audit_logs al
      WHERE al.user_id = $1 AND al.table_name = 'domains' AND al.record_id = $2
    `, [req.user.id, req.params.domainId]);

    // Get paginated results
    const result = await pool.query(`
      SELECT 
        al.*,
        u.email as user_email,
        u.first_name,
        u.last_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.user_id = $1 AND al.table_name = 'domains' AND al.record_id = $2
      ORDER BY al.created_at DESC
      LIMIT $3 OFFSET $4
    `, [req.user.id, req.params.domainId, limit, offset]);

    res.json({
      logs: result.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].total),
        totalPages: Math.ceil(countResult.rows[0].total / limit)
      }
    });
  } catch (error) {
    console.error('Get domain audit logs error:', error);
    res.status(500).json({ error: 'Failed to fetch domain audit logs' });
  }
});

// Get audit statistics
router.get('/stats', async (req, res) => {
  try {
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    let whereConditions = ['al.user_id = $1'];
    let values = [req.user.id];
    let paramCount = 1;

    if (startDate) {
      whereConditions.push(`al.created_at >= $${++paramCount}`);
      values.push(startDate);
    }

    if (endDate) {
      whereConditions.push(`al.created_at <= $${++paramCount}`);
      values.push(endDate);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get action statistics
    const actionStats = await pool.query(`
      SELECT 
        action,
        COUNT(*) as count
      FROM audit_logs al
      ${whereClause}
      GROUP BY action
      ORDER BY count DESC
    `, values);

    // Get table statistics
    const tableStats = await pool.query(`
      SELECT 
        table_name,
        COUNT(*) as count
      FROM audit_logs al
      ${whereClause}
      GROUP BY table_name
      ORDER BY count DESC
    `, values);

    // Get daily activity
    const dailyActivity = await pool.query(`
      SELECT 
        DATE(al.created_at) as date,
        COUNT(*) as count
      FROM audit_logs al
      ${whereClause}
      GROUP BY DATE(al.created_at)
      ORDER BY date DESC
      LIMIT 30
    `, values);

    // Get recent activity
    const recentActivity = await pool.query(`
      SELECT 
        al.*,
        u.first_name,
        u.last_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT 10
    `, values);

    res.json({
      actionStats: actionStats.rows,
      tableStats: tableStats.rows,
      dailyActivity: dailyActivity.rows,
      recentActivity: recentActivity.rows
    });
  } catch (error) {
    console.error('Get audit stats error:', error);
    res.status(500).json({ error: 'Failed to fetch audit statistics' });
  }
});

// Export audit logs
router.get('/export', async (req, res) => {
  try {
    const format = req.query.format || 'json';
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    let whereConditions = ['al.user_id = $1'];
    let values = [req.user.id];
    let paramCount = 1;

    if (startDate) {
      whereConditions.push(`al.created_at >= $${++paramCount}`);
      values.push(startDate);
    }

    if (endDate) {
      whereConditions.push(`al.created_at <= $${++paramCount}`);
      values.push(endDate);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const result = await pool.query(`
      SELECT 
        al.*,
        u.email as user_email,
        u.first_name,
        u.last_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
      ORDER BY al.created_at DESC
    `, values);

    if (format === 'csv') {
      const csv = convertToCSV(result.rows);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csv);
    } else {
      res.json({
        logs: result.rows,
        exportDate: new Date().toISOString(),
        totalRecords: result.rows.length
      });
    }
  } catch (error) {
    console.error('Export audit logs error:', error);
    res.status(500).json({ error: 'Failed to export audit logs' });
  }
});

// Helper function to convert data to CSV
function convertToCSV(data) {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const csvRows = [];

  // Add headers
  csvRows.push(headers.join(','));

  // Add data rows
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      // Escape commas and quotes in CSV
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value || '';
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}

// Get audit log details
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        al.*,
        u.email as user_email,
        u.first_name,
        u.last_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.id = $1 AND al.user_id = $2
    `, [req.params.id, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Audit log not found' });
    }

    res.json({ log: result.rows[0] });
  } catch (error) {
    console.error('Get audit log details error:', error);
    res.status(500).json({ error: 'Failed to fetch audit log details' });
  }
});

module.exports = router; 