#!/bin/bash
# Quick setup script for iTrader - fully automated with no prompts
# Usage: curl -s https://raw.githubusercontent.com/username/aitrader/main/scripts/quicksetup.sh | bash

set -e  # Exit on error

# Print status messages
echo "[SETUP] Starting iTrader quick setup..."

# Update system packages
echo "[SETUP] Updating system packages..."
sudo apt update -y && sudo apt upgrade -y

# Install required system dependencies
echo "[SETUP] Installing system dependencies..."
sudo apt install -y curl wget git build-essential libssl-dev 

# Install Node.js if not installed
if ! command -v node > /dev/null; then
  echo "[SETUP] Installing Node.js..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
  echo "[SUCCESS] Node.js installed: $(node -v)"
else
  echo "[INFO] Node.js already installed: $(node -v)"
fi

# Install Bun if not installed
if ! command -v bun > /dev/null; then
  echo "[SETUP] Installing Bun runtime..."
  curl -fsSL https://bun.sh/install | bash
  # Source for current session
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
  echo "[SUCCESS] Bun installed: $(bun --version)"
else
  echo "[INFO] Bun already installed: $(bun --version)"
fi

# Install PostgreSQL if not installed
if ! command -v psql > /dev/null; then
  echo "[SETUP] Installing PostgreSQL..."
  sudo apt install -y postgresql postgresql-contrib
  sudo systemctl start postgresql
  sudo systemctl enable postgresql
  echo "[SUCCESS] PostgreSQL installed"
else
  echo "[INFO] PostgreSQL already installed"
fi

# Configure PostgreSQL
echo "[SETUP] Configuring PostgreSQL..."
# Create database user if not exists
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='aitrader'" | grep -q 1; then
  sudo -u postgres psql -c "CREATE USER aitrader WITH PASSWORD 'aitraderpassword';"
  sudo -u postgres psql -c "ALTER USER aitrader CREATEDB;"
fi

# Create database if not exists
if ! sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw aitrader; then
  sudo -u postgres psql -c "CREATE DATABASE aitrader OWNER aitrader;"
fi

# Clone the repository if not in directory
if [ ! -d "aitrader" ]; then
  echo "[SETUP] Cloning repository..."
  git clone https://github.com/username/aitrader.git
  cd aitrader
else
  echo "[INFO] Repository already exists"
  # If we're not already in the aitrader directory, change to it
  if [ "$(basename $(pwd))" != "aitrader" ]; then
    cd aitrader
  fi
fi

# Create environment files
echo "[SETUP] Creating environment files..."
# Server .env
if [ ! -f "server/.env" ]; then
  cat > "server/.env" << EOF
PORT=3000
NODE_ENV=development
JWT_SECRET=dev_secret_change_in_production
JWT_EXPIRATION=24h
DATABASE_URL=postgresql://aitrader:aitraderpassword@localhost:5432/aitrader
CORS_ORIGINS=http://localhost:3001,https://localhost:3001
GATE_API_URL=https://www.gate.cx
BYBIT_API_URL=https://api.bybit.com
BYBIT_TESTNET_API_URL=https://api-testnet.bybit.com
BYBIT_USE_TESTNET=true
LOG_LEVEL=debug
ADMIN_TOKEN=dev_admin_token_change_in_production
SESSION_REFRESH_INTERVAL=300000
ALLOW_DEV_ACCESS=true
USE_MOCK_DATA=true
EOF
fi

# Frontend .env.local
if [ ! -f "frontend/.env.local" ]; then
  cat > "frontend/.env.local" << EOF
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_SOCKET_URL=http://localhost:3000
EOF
fi

# Install dependencies
echo "[SETUP] Installing project dependencies..."
npm install

# Install server dependencies
echo "[SETUP] Installing server dependencies..."
cd server
bun install

# Initialize Prisma
echo "[SETUP] Initializing database..."
bun run prisma:generate
bun run prisma:migrate

# Create admin user
echo "[SETUP] Creating admin user..."
bun run src/cli.ts create-admin --username admin --password admin --token admin || true

# Return to project root and install frontend dependencies
cd ..
echo "[SETUP] Installing frontend dependencies..."
cd frontend
npm install

# Return to project root
cd ..

# Create SSL directory
mkdir -p nginx/ssl

# Setup success message
echo ""
echo "============================================="
echo "[SUCCESS] iTrader environment setup complete!"
echo "============================================="
echo "You can now start the development servers with:"
echo "  npm run dev"
echo ""
echo "Default admin credentials:"
echo "  Username: admin"
echo "  Password: admin"
echo "  Token: admin"
echo "============================================="