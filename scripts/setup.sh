#!/bin/bash

# iTrader Development Environment Setup Script
# This script sets up everything needed for iTrader development on a fresh Ubuntu installation
# Runs in fully automated mode with no prompts or confirmations

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored messages
print_message() {
  echo -e "${BLUE}[SETUP]${NC} $1"
}

print_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Print welcome message
echo "============================================="
echo -e "${BLUE}iTrader Development Environment Setup${NC}"
echo "============================================="
echo "Setting up environment for iTrader development."
echo "Installing and configuring: Node.js, Bun, PostgreSQL, and project dependencies."
echo "============================================="

# Update system packages
print_message "Updating system packages..."
sudo apt update && sudo apt upgrade -y
if [ $? -ne 0 ]; then
  print_error "Failed to update system packages"
  exit 1
fi
print_success "System packages updated"

# Install required system dependencies
print_message "Installing required system dependencies..."
sudo apt install -y curl wget git build-essential libssl-dev

# Install Node.js if not installed
if ! command_exists node; then
  print_message "Installing Node.js..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
  print_success "Node.js installed: $(node -v)"
else
  print_success "Node.js already installed: $(node -v)"
fi

# Install Bun if not installed
if ! command_exists bun; then
  print_message "Installing Bun runtime..."
  curl -fsSL https://bun.sh/install | bash
  source ~/.bashrc
  print_success "Bun installed: $(bun --version)"
else
  print_success "Bun already installed: $(bun --version)"
fi

# Install PostgreSQL if not installed
if ! command_exists psql; then
  print_message "Installing PostgreSQL..."
  sudo apt install -y postgresql postgresql-contrib
  
  # Start PostgreSQL service
  sudo systemctl start postgresql
  sudo systemctl enable postgresql
  
  print_success "PostgreSQL installed and service started"
else
  print_success "PostgreSQL already installed"
fi

# Configure PostgreSQL
print_message "Configuring PostgreSQL..."

# Check if the user exists
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='aitrader'" | grep -q 1; then
  # Create database user
  sudo -u postgres psql -c "CREATE USER aitrader WITH PASSWORD 'aitraderpassword';"
  sudo -u postgres psql -c "ALTER USER aitrader CREATEDB;"
  print_success "PostgreSQL user 'aitrader' created"
else
  print_success "PostgreSQL user 'aitrader' already exists"
fi

# Check if the database exists
if ! sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw aitrader; then
  # Create database
  sudo -u postgres psql -c "CREATE DATABASE aitrader OWNER aitrader;"
  print_success "PostgreSQL database 'aitrader' created"
else
  print_success "PostgreSQL database 'aitrader' already exists"
fi

# Navigate to project root
print_message "Setting up project..."
PROJECT_ROOT="$(pwd)"

# Create .env file for the server if it doesn't exist
if [ ! -f "$PROJECT_ROOT/server/.env" ]; then
  print_message "Creating environment file for server..."
  cat > "$PROJECT_ROOT/server/.env" << EOF
# Server
PORT=3000
NODE_ENV=development
JWT_SECRET=dev_secret_change_in_production
JWT_EXPIRATION=24h

# Database
DATABASE_URL=postgresql://aitrader:aitraderpassword@localhost:5432/aitrader

# CORS
CORS_ORIGINS=http://localhost:3001,https://localhost:3001

# Gate.cx
GATE_API_URL=https://www.gate.cx

# Bybit
BYBIT_API_URL=https://api.bybit.com
BYBIT_TESTNET_API_URL=https://api-testnet.bybit.com
BYBIT_USE_TESTNET=true

# Logger
LOG_LEVEL=debug

# Admin
ADMIN_TOKEN=dev_admin_token_change_in_production

# Session refresh interval (in milliseconds)
SESSION_REFRESH_INTERVAL=300000

# Development mode
ALLOW_DEV_ACCESS=true

# Mock data for testing
USE_MOCK_DATA=true
EOF
  print_success "Server environment file created"
else
  print_success "Server environment file already exists"
fi

# Create .env file for the frontend if it doesn't exist
if [ ! -f "$PROJECT_ROOT/frontend/.env.local" ]; then
  print_message "Creating environment file for frontend..."
  cat > "$PROJECT_ROOT/frontend/.env.local" << EOF
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_SOCKET_URL=http://localhost:3000
EOF
  print_success "Frontend environment file created"
else
  print_success "Frontend environment file already exists"
fi

# Install project dependencies
print_message "Installing project dependencies..."
npm install

# Install server dependencies
print_message "Installing server dependencies..."
cd "$PROJECT_ROOT/server"
bun install
if [ $? -ne 0 ]; then
  print_error "Failed to install server dependencies"
  exit 1
fi
print_success "Server dependencies installed"

# Install frontend dependencies
print_message "Installing frontend dependencies..."
cd "$PROJECT_ROOT/frontend"
npm install
if [ $? -ne 0 ]; then
  print_error "Failed to install frontend dependencies"
  exit 1
fi
print_success "Frontend dependencies installed"

# Return to project root
cd "$PROJECT_ROOT"

# Initialize Prisma
print_message "Initializing database with Prisma..."
cd "$PROJECT_ROOT/server"
bun run prisma:generate
if [ $? -ne 0 ]; then
  print_error "Failed to generate Prisma client"
  exit 1
fi

# Apply migrations
print_message "Applying database migrations..."
bun run prisma:migrate
if [ $? -ne 0 ]; then
  print_error "Failed to apply database migrations"
  exit 1
fi
print_success "Database initialized successfully"

# Check if database is accessible
print_message "Checking database connection..."
cd "$PROJECT_ROOT"
npm run db:check
if [ $? -ne 0 ]; then
  print_error "Database connection check failed"
  print_warning "Please check your PostgreSQL configuration and try again"
  exit 1
fi
print_success "Database connection verified"

# Create default admin account
print_message "Creating default admin account..."
cd "$PROJECT_ROOT/server"
bun run src/cli.ts create-admin --username admin --password admin --token admin
if [ $? -ne 0 ]; then
  print_warning "Failed to create default admin account. This might be OK if it already exists."
fi

# Return to project root
cd "$PROJECT_ROOT"

# Generate SSL certificates for local development
print_message "Generating SSL certificates for development..."
mkdir -p "$PROJECT_ROOT/nginx/ssl"
if [ ! -f "$PROJECT_ROOT/nginx/ssl/localhost.crt" ]; then
  bash "$PROJECT_ROOT/scripts/generate-ssl.sh"
  if [ $? -ne 0 ]; then
    print_warning "Failed to generate SSL certificates. HTTPS functionality may not work properly."
  else
    print_success "SSL certificates generated"
  fi
else
  print_success "SSL certificates already exist"
fi

# Update hosts file for local development
if ! grep -q "localhost.itrader.local" /etc/hosts; then
  print_message "Updating hosts file..."
  echo "127.0.0.1 localhost.itrader.local" | sudo tee -a /etc/hosts
  print_success "Hosts file updated"
else
  print_success "Hosts file already configured"
fi

# Print summary
echo ""
echo "============================================="
echo -e "${GREEN}iTrader Development Environment Setup Complete!${NC}"
echo "============================================="
echo "You can now start the development servers using:"
echo "  npm run dev              # Start both frontend and backend"
echo "  npm run dev:server       # Start only the backend"
echo "  npm run dev:frontend     # Start only the frontend"
echo ""
echo "Access the application at:"
echo "  Frontend: http://localhost:3001"
echo "  Backend API: http://localhost:3000"
echo "  API Documentation: http://localhost:3000/docs"
echo ""
echo "Default admin credentials:"
echo "  Username: admin"
echo "  Password: admin"
echo "  Token: admin"
echo ""
echo "Database connection:"
echo "  Host: localhost"
echo "  Port: 5432"
echo "  Database: aitrader"
echo "  Username: aitrader"
echo "  Password: aitraderpassword"
echo ""
echo "You can access the database using:"
echo "  npm run prisma:studio    # Prisma Studio UI"
echo "============================================="