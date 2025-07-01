# Domain Manager

A comprehensive full-stack web application for managing domains with SSL monitoring, alert notifications, and health status tracking. Built with React, Node.js, Express, and PostgreSQL.

## Features

### 🔐 User Authentication
- Secure JWT-based authentication
- User registration and login
- Profile management
- Password hashing with bcrypt

### 🌐 Domain Management
- CRUD operations for domains
- Domain health monitoring
- Expiry date tracking
- Registrar information management
- Purchase details and cost tracking

### 🔒 SSL Certificate Monitoring
- Automatic SSL certificate checking
- Certificate expiry tracking
- SSL health status monitoring
- Certificate issuer information
- Bulk SSL checking for all domains

### 🚨 Alert System
- Email notifications via SMTP
- SMS notifications via Twilio
- Configurable alert preferences
- Domain expiry alerts
- SSL certificate expiry alerts
- Downtime monitoring alerts

### 📊 Dashboard & Analytics
- Real-time domain health overview
- Interactive charts and statistics
- Expiring domains tracking
- SSL certificate status visualization
- Cost analysis and reporting

### 📝 Audit Logging
- Complete activity tracking
- User action history
- Change logging for all operations
- Export functionality (JSON/CSV)
- Detailed audit reports

## Tech Stack

### Frontend
- **React 18** - Modern UI framework
- **Tailwind CSS** - Utility-first CSS framework
- **React Router** - Client-side routing
- **React Query** - Server state management
- **Recharts** - Data visualization
- **React Hook Form** - Form handling
- **React Hot Toast** - Notifications

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web framework
- **PostgreSQL** - Primary database
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **node-cron** - Scheduled tasks
- **nodemailer** - Email sending
- **Twilio** - SMS notifications

### DevOps
- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration
- **Nginx** - Reverse proxy
- **PM2** - Process management (production)

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 15+
- Docker and Docker Compose (for containerized deployment)
- SMTP credentials (for email alerts)
- Twilio account (for SMS alerts)

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd domain-manager
```

### 2. Environment Setup

Copy the example environment file and configure your settings:

```bash
cp env.example .env
```

Edit `.env` with your configuration:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=domain_manager
DB_USER=postgres
DB_PASSWORD=your_password

# JWT
JWT_SECRET=your-super-secret-jwt-key

# Email (Gmail example)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Twilio (optional)
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=your-twilio-number
```

### 3. Install Dependencies

```bash
# Install all dependencies (root, server, and client)
npm run install-all
```

### 4. Database Setup

Create a PostgreSQL database:

```sql
CREATE DATABASE domain_manager;
```

The application will automatically create all required tables on first run.

### 5. Start Development Servers

```bash
# Start both frontend and backend in development mode
npm run dev
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- Health Check: http://localhost:5000/health

## Docker Deployment

### Using Docker Compose (Recommended)

1. **Build and start all services:**

```bash
docker-compose up -d
```

2. **View logs:**

```bash
docker-compose logs -f
```

3. **Stop services:**

```bash
docker-compose down
```

### Manual Docker Build

```bash
# Build the image
docker build -t domain-manager .

# Run the container
docker run -p 5000:5000 --env-file .env domain-manager
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile

### Domains
- `GET /api/domains` - Get all domains
- `GET /api/domains/:id` - Get domain by ID
- `POST /api/domains` - Create new domain
- `PUT /api/domains/:id` - Update domain
- `DELETE /api/domains/:id` - Delete domain
- `GET /api/domains/stats/overview` - Get domain statistics
- `GET /api/domains/expiring-soon` - Get expiring domains

### SSL Certificates
- `POST /api/ssl/check/:domainId` - Check SSL certificate
- `GET /api/ssl/:domainId` - Get SSL certificate
- `PUT /api/ssl/:domainId` - Update SSL certificate
- `DELETE /api/ssl/:domainId` - Delete SSL certificate
- `POST /api/ssl/bulk-check` - Bulk SSL check

### Alerts
- `GET /api/alerts` - Get all alerts
- `POST /api/alerts` - Create alert
- `PUT /api/alerts/:id` - Update alert
- `DELETE /api/alerts/:id` - Delete alert
- `POST /api/alerts/test/:id` - Test alert notification

### Audit Logs
- `GET /api/audit` - Get audit logs
- `GET /api/audit/stats` - Get audit statistics
- `GET /api/audit/export` - Export audit logs

## Monitoring & Cron Jobs

The application includes automated monitoring with the following scheduled tasks:

- **Daily Monitoring** (9 AM UTC) - Domain expiry checks
- **SSL Monitoring** (Every 6 hours) - SSL certificate validation
- **Uptime Monitoring** (Every 30 minutes) - Domain availability checks
- **Alert Checking** (Every hour) - Send notifications for expiring domains/SSL

## Production Deployment

### AWS Deployment

1. **EC2 Setup:**
   - Launch Ubuntu EC2 instance
   - Install Docker and Docker Compose
   - Configure security groups (ports 80, 443, 22)

2. **Domain & SSL:**
   - Point domain to EC2 IP
   - Configure SSL certificates with Let's Encrypt
   - Update nginx.conf with your domain

3. **Environment Variables:**
   - Set production environment variables
   - Use strong JWT secret
   - Configure production database

4. **Deploy:**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

### DigitalOcean Deployment

1. **Droplet Setup:**
   - Create Ubuntu droplet
   - Install Docker and Docker Compose
   - Configure firewall

2. **Deploy Application:**
   ```bash
   git clone <repository>
   cd domain-manager
   docker-compose up -d
   ```

## Security Features

- **JWT Authentication** - Secure token-based authentication
- **Password Hashing** - bcrypt with salt rounds
- **Rate Limiting** - API request throttling
- **CORS Protection** - Cross-origin request security
- **Helmet.js** - Security headers
- **Input Validation** - Request data sanitization
- **SQL Injection Protection** - Parameterized queries
- **XSS Protection** - Content Security Policy

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the API endpoints

## Roadmap

- [ ] Multi-tenant support
- [ ] Advanced SSL certificate management
- [ ] Domain transfer tracking
- [ ] DNS management integration
- [ ] Advanced reporting and analytics
- [ ] Mobile application
- [ ] API rate limiting dashboard
- [ ] Webhook integrations
- [ ] Backup and restore functionality 