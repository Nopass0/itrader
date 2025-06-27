# iTrader Deployment Guide

## Quick Start

### Development Mode
```bash
./server.sh
# Or
./start-server.sh
```

### Production Mode
```bash
./start-server.sh production
```

## Server Deployment

### 1. System Requirements
- Ubuntu 20.04+ or similar Linux distribution
- Node.js 18+ and npm
- Bun runtime
- Ports 3000 and 3002 available
- At least 2GB RAM

### 2. Installation

#### Install dependencies
```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Bun
curl -fsSL https://bun.sh/install | bash

# Install project dependencies
bun install
cd frontend && npm install
```

#### Create user (optional but recommended)
```bash
sudo useradd -m -s /bin/bash itrader
sudo mkdir -p /home/itrader/itrader_project
sudo chown -R itrader:itrader /home/itrader/itrader_project
```

### 3. Configuration

#### Environment Variables
Create `.env` file:
```env
NODE_ENV=production
MODE=auto
EXTERNAL_IP=YOUR_SERVER_IP  # Optional, will auto-detect if not set
CORS_ORIGIN=*  # Or specific domains
```

#### Build Frontend
```bash
cd frontend
npm run build
```

### 4. Firewall Configuration

Open required ports:
```bash
# Using ufw
sudo ufw allow 3000/tcp  # Frontend
sudo ufw allow 3002/tcp  # WebSocket API
sudo ufw allow 22/tcp    # SSH
sudo ufw enable

# Using iptables
sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 3002 -j ACCEPT
```

### 5. Running as Service

#### Using systemd
```bash
# Copy service files
sudo cp itrader.service /etc/systemd/system/
sudo cp itrader-frontend.service /etc/systemd/system/

# Update paths in service files if needed
sudo nano /etc/systemd/system/itrader.service
sudo nano /etc/systemd/system/itrader-frontend.service

# Reload systemd
sudo systemctl daemon-reload

# Enable services
sudo systemctl enable itrader
sudo systemctl enable itrader-frontend

# Start services
sudo systemctl start itrader
sudo systemctl start itrader-frontend

# Check status
sudo systemctl status itrader
sudo systemctl status itrader-frontend

# View logs
sudo journalctl -u itrader -f
sudo journalctl -u itrader-frontend -f
```

#### Using PM2 (alternative)
```bash
# Install PM2
npm install -g pm2

# Start services
pm2 start src/app.ts --name itrader-backend --interpreter bun
pm2 start npm --name itrader-frontend -- run start --prefix frontend

# Save PM2 configuration
pm2 save
pm2 startup
```

### 6. Nginx Reverse Proxy (Recommended)

Install Nginx:
```bash
sudo apt install nginx
```

Create Nginx configuration:
```nginx
# /etc/nginx/sites-available/itrader
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket API
    location /socket.io/ {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/itrader /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 7. SSL Certificate (Recommended)

Using Let's Encrypt:
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 8. Access URLs

After deployment, access your application at:

- **Local Access:**
  - Panel: http://localhost:3000
  - API: http://localhost:3002

- **External Access (Direct IP):**
  - Panel: http://YOUR_SERVER_IP:3000
  - API: http://YOUR_SERVER_IP:3002

- **Domain Access (with Nginx):**
  - Panel: https://your-domain.com
  - API: https://your-domain.com/socket.io/

### 9. Default Admin Account

On first run, create an admin account:
```bash
./server.sh
# Select option 6 (Account Management)
# Then option 1 (Create/Reset Admin Account)
```

### 10. Monitoring

#### Check service status
```bash
sudo systemctl status itrader
sudo systemctl status itrader-frontend
```

#### View logs
```bash
# System logs
sudo journalctl -u itrader -f
sudo journalctl -u itrader-frontend -f

# Application logs
tail -f logs/*.log
```

#### Monitor resources
```bash
htop
# or
docker stats  # if using Docker
```

### 11. Backup

Create backup script:
```bash
#!/bin/bash
BACKUP_DIR="/backup/itrader"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
cp prisma/database.db $BACKUP_DIR/database_$DATE.db

# Backup environment files
cp .env $BACKUP_DIR/env_$DATE

# Backup logs
tar -czf $BACKUP_DIR/logs_$DATE.tar.gz logs/

# Keep only last 7 days of backups
find $BACKUP_DIR -type f -mtime +7 -delete
```

### 12. Troubleshooting

#### Service won't start
```bash
# Check logs
sudo journalctl -u itrader -n 100
sudo journalctl -u itrader-frontend -n 100

# Check permissions
ls -la /home/itrader/itrader_project

# Check ports
sudo netstat -tlnp | grep -E '3000|3002'
```

#### MailSlurp API key error
If you get `Unknown argument apiKey` error:
```bash
# Regenerate Prisma client
bunx prisma generate

# Run database migration
bunx prisma db push

# Update existing MailSlurp accounts with API key
bun run scripts/update-mailslurp-apikey.ts
```

#### Database corrupted error
If you get "database disk image is malformed":
```bash
# Run the repair script
./scripts/repair-database.sh

# Or manually reset:
rm -f prisma/database.db prisma/database.db-*
bunx prisma generate
bunx prisma db push
```
See [DATABASE_REPAIR.md](./DATABASE_REPAIR.md) for detailed instructions.

#### Can't access from external IP
- Check firewall rules
- Ensure services are listening on 0.0.0.0, not just localhost
- Verify your server's external IP
- Check if your hosting provider has additional firewall rules

#### WebSocket connection issues
- Ensure CORS is properly configured
- Check that WebSocket upgrade headers are passed through proxy
- Verify frontend is using correct API URL

### 13. Security Recommendations

1. **Use HTTPS** - Always use SSL certificates in production
2. **Firewall** - Only open necessary ports
3. **Updates** - Keep system and dependencies updated
4. **Passwords** - Use strong passwords for all accounts
5. **Monitoring** - Set up monitoring and alerts
6. **Backup** - Regular automated backups
7. **Access Logs** - Monitor access logs for suspicious activity

### 14. Performance Tuning

#### Node.js
```bash
# Increase memory limit if needed
export NODE_OPTIONS="--max-old-space-size=4096"
```

#### System limits
```bash
# Edit /etc/security/limits.conf
* soft nofile 65536
* hard nofile 65536
```

#### Database optimization
- Regular VACUUM for SQLite
- Consider migration to PostgreSQL for high load