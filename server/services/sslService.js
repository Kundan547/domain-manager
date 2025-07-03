const https = require('https');
const tls = require('tls');
const { URL } = require('url');

async function checkSSLCertificate(domain) {
  try {
    // Ensure domain has protocol
    const domainUrl = domain.startsWith('http') ? domain : `https://${domain}`;
    const url = new URL(domainUrl);
    
    return new Promise((resolve, reject) => {
      const options = {
        hostname: url.hostname,
        port: 443,
        method: 'GET',
        timeout: 10000,
        rejectUnauthorized: false
      };

      const req = https.request(options, (res) => {
        const cert = res.socket.getPeerCertificate();
        
        if (cert && cert.valid_from && cert.valid_to) {
          const now = new Date();
          const validFrom = new Date(cert.valid_from);
          const validUntil = new Date(cert.valid_to);
          
          let status = 'valid';
          if (validUntil < now) {
            status = 'expired';
          } else if (validUntil < new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)) {
            status = 'expiring_soon';
          }

          resolve({
            issuer: cert.issuer?.CN || cert.issuer?.O || 'Unknown',
            validFrom: validFrom.toISOString().split('T')[0],
            validUntil: validUntil.toISOString().split('T')[0],
            cost: null, // Would need external API to get cost
            purchaseLocation: null, // Would need external API to get purchase location
            status: status,
            subject: cert.subject?.CN || domain,
            serialNumber: cert.serialNumber,
            fingerprint: cert.fingerprint
          });
        } else {
          reject(new Error('No valid certificate found'));
        }
      });

      req.on('error', (error) => {
        // Try alternative method using tls module
        checkWithTLS(url.hostname)
          .then(resolve)
          .catch(reject);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  } catch (error) {
    console.error(`SSL check error for ${domain}:`, error);
    return null;
  }
}

async function checkWithTLS(hostname) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({
      host: hostname,
      port: 443,
      timeout: 10000,
      rejectUnauthorized: false
    }, () => {
      const cert = socket.getPeerCertificate();
      
      if (cert && cert.valid_from && cert.valid_to) {
        const now = new Date();
        const validFrom = new Date(cert.valid_from);
        const validUntil = new Date(cert.valid_to);
        
        let status = 'valid';
        if (validUntil < now) {
          status = 'expired';
        } else if (validUntil < new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)) {
          status = 'expiring_soon';
        }

        socket.end();
        
        resolve({
          issuer: cert.issuer?.CN || cert.issuer?.O || 'Unknown',
          validFrom: validFrom.toISOString().split('T')[0],
          validUntil: validUntil.toISOString().split('T')[0],
          cost: null,
          purchaseLocation: null,
          status: status,
          subject: cert.subject?.CN || hostname,
          serialNumber: cert.serialNumber,
          fingerprint: cert.fingerprint
        });
      } else {
        socket.end();
        reject(new Error('No valid certificate found'));
      }
    });

    socket.on('error', (error) => {
      reject(error);
    });

    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('Connection timeout'));
    });
  });
}

// Enhanced SSL check with more detailed information
async function getDetailedSSLCertificate(domain) {
  try {
    const basicInfo = await checkSSLCertificate(domain);
    if (!basicInfo) return null;

    // Additional checks could be added here:
    // - Check certificate chain
    // - Verify certificate authority
    // - Check for certificate transparency
    // - Get certificate cost from external APIs

    return {
      ...basicInfo,
      daysUntilExpiry: Math.ceil((new Date(basicInfo.validUntil) - new Date()) / (1000 * 60 * 60 * 24)),
      isExpired: new Date(basicInfo.validUntil) < new Date(),
      isExpiringSoon: new Date(basicInfo.validUntil) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    };
  } catch (error) {
    console.error(`Detailed SSL check error for ${domain}:`, error);
    return null;
  }
}

module.exports = {
  checkSSLCertificate,
  getDetailedSSLCertificate
}; 