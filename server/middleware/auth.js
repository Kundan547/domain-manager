const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Verify user still exists in database
    const result = await pool.query('SELECT id, email, first_name, last_name FROM users WHERE id = $1', [decoded.userId]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(403).json({ error: 'Invalid token' });
  }
};

const auditLog = async (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Log the action after response is sent
    if (req.user && req.method !== 'GET') {
      const logData = {
        user_id: req.user.id,
        action: `${req.method} ${req.originalUrl}`,
        table_name: req.originalUrl.split('/')[2], // Extract table name from URL
        record_id: req.params.id || null,
        old_values: req.method === 'PUT' || req.method === 'DELETE' ? req.body : null,
        new_values: req.method === 'POST' || req.method === 'PUT' ? req.body : null,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      };

      // Async logging - don't wait for it
      pool.query(`
        INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [logData.user_id, logData.action, logData.table_name, logData.record_id, 
          logData.old_values, logData.new_values, logData.ip_address, logData.user_agent])
        .catch(err => console.error('Audit log error:', err));
    }
    
    originalSend.call(this, data);
  };
  
  next();
};

module.exports = {
  authenticateToken,
  auditLog
}; 