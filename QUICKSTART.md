# Quick Start Guide

## TL;DR - Fastest Way to Start

```bash
# Clone and start
git clone https://github.com/Nopass0/itrader.git
cd itrader
./quick-start.sh
```

That's it! The application will be available at:
- **Panel**: http://localhost:3000
 - **API**: http://localhost:3002

## Manual Start

### 1. Install Dependencies

```bash
# Backend
bun install

# Frontend
cd frontend && npm install && cd ..
```

### 2. Setup Database

```bash
# Generate Prisma client
bunx prisma generate

# Create database
bunx prisma db push
```

### 3. Configure Environment

```bash
# Copy example config
cp .env.example .env

# Edit with your settings
nano .env
```

### 4. Start Services

#### Option A: Using quick-start script
```bash
# Development mode (with hot reload)
./quick-start.sh

# Production mode
./quick-start.sh production
```

#### Option B: Using server.sh menu
```bash
./server.sh
# Select option 1 for development
# Or option 2 for production
```

#### Option C: Manual start
```bash
# Terminal 1 - Backend
WEBSOCKET_PORT=3002 bun run src/app.ts

# Terminal 2 - Frontend
cd frontend && npm run dev
```

## First Time Setup

1. **Create Admin Account**
   ```bash
   ./server.sh
   # Select option 6 -> 1
   ```

2. **Access Panel**
   - Open http://localhost:3000
   - Login with your admin credentials

3. **Add Trading Accounts**
   - Go to Settings -> Accounts
   - Add your Gate.io and Bybit accounts

## Troubleshooting

### Port Already in Use
```bash
# Kill existing processes
pkill -f "bun.*app.ts"
pkill -f "next dev"

# Or find specific process
lsof -i :3000
lsof -i :3002
```

### Frontend Not Loading
- Make sure both services are running
- Check that ports 3000 and 3002 are not blocked
- Try accessing http://localhost:3000 directly

### WebSocket Connection Failed
- Ensure backend is running on port 3002
- Check browser console for errors
- Try clearing browser cache

### Database Errors
```bash
# Reset database
rm -f prisma/database.db
bunx prisma generate
bunx prisma db push
```

## Production Deployment

For production deployment with external access:

1. **Set Environment Variables**
   ```bash
   export NODE_ENV=production
   export WEBSOCKET_PORT=3002
   export EXTERNAL_IP=your.server.ip
   ```

2. **Open Firewall Ports**
   ```bash
   sudo ufw allow 3000/tcp
   sudo ufw allow 3002/tcp
   ```

3. **Use Process Manager**
   ```bash
   # Install PM2
   npm install -g pm2

   # Start services
   pm2 start ecosystem.config.js
   ```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.