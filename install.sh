#!/bin/bash

# Itrader Project Installation Script
# This script installs all required dependencies for the project

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_info() {
    echo -e "${YELLOW}[i]${NC} $1"
}

# Header
echo "====================================="
echo "   Itrader Project Setup Script      "
echo "====================================="
echo ""

# Check OS
OS=""
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
    print_info "Detected OS: Linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
    print_info "Detected OS: macOS"
else
    print_error "Unsupported OS: $OSTYPE"
    exit 1
fi

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Update package manager
print_info "Updating package manager..."
if [ "$OS" == "linux" ]; then
    if command_exists apt-get; then
        sudo apt-get update -qq
    elif command_exists yum; then
        sudo yum update -y -q
    fi
fi

# Install system dependencies
print_info "Installing system dependencies..."
if [ "$OS" == "linux" ]; then
    if command_exists apt-get; then
        # Debian/Ubuntu
        sudo apt-get install -y curl wget git build-essential python3 python3-pip unzip
    elif command_exists yum; then
        # RedHat/CentOS
        sudo yum install -y curl wget git gcc gcc-c++ make python3 python3-pip unzip
    fi
elif [ "$OS" == "macos" ]; then
    # Check if Homebrew is installed
    if ! command_exists brew; then
        print_info "Installing Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    fi
    brew install curl wget git python3 unzip
fi

# Install Node.js if not present (required for some dependencies)
if ! command_exists node; then
    print_info "Installing Node.js..."
    if [ "$OS" == "linux" ]; then
        curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
        sudo apt-get install -y nodejs
    elif [ "$OS" == "macos" ]; then
        brew install node
    fi
else
    print_status "Node.js is already installed: $(node --version)"
fi

# Install Bun
if ! command_exists bun; then
    print_info "Installing Bun..."
    curl -fsSL https://bun.sh/install | bash
    
    # Add Bun to PATH for current session
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
    
    # Add Bun to shell profiles for permanent access
    print_info "Setting up Bun in shell profiles..."
    
    # For bash
    if [ -f "$HOME/.bashrc" ]; then
        if ! grep -q "BUN_INSTALL" "$HOME/.bashrc"; then
            echo "" >> "$HOME/.bashrc"
            echo "# Bun" >> "$HOME/.bashrc"
            echo 'export BUN_INSTALL="$HOME/.bun"' >> "$HOME/.bashrc"
            echo 'export PATH="$BUN_INSTALL/bin:$PATH"' >> "$HOME/.bashrc"
            print_status "Added Bun to ~/.bashrc"
        fi
    fi
    
    # For zsh
    if [ -f "$HOME/.zshrc" ]; then
        if ! grep -q "BUN_INSTALL" "$HOME/.zshrc"; then
            echo "" >> "$HOME/.zshrc"
            echo "# Bun" >> "$HOME/.zshrc"
            echo 'export BUN_INSTALL="$HOME/.bun"' >> "$HOME/.zshrc"
            echo 'export PATH="$BUN_INSTALL/bin:$PATH"' >> "$HOME/.zshrc"
            print_status "Added Bun to ~/.zshrc"
        fi
    fi
    
    # For general profile
    if [ -f "$HOME/.profile" ]; then
        if ! grep -q "BUN_INSTALL" "$HOME/.profile"; then
            echo "" >> "$HOME/.profile"
            echo "# Bun" >> "$HOME/.profile"
            echo 'export BUN_INSTALL="$HOME/.bun"' >> "$HOME/.profile"
            echo 'export PATH="$BUN_INSTALL/bin:$PATH"' >> "$HOME/.profile"
            print_status "Added Bun to ~/.profile"
        fi
    fi
    
    # Verify installation
    if command_exists bun; then
        print_status "Bun installed successfully: $(bun --version)"
    else
        print_error "Failed to install Bun"
        exit 1
    fi
else
    print_status "Bun is already installed: $(bun --version)"
fi

# Create necessary directories
print_info "Creating project directories..."
mkdir -p data/cookies
mkdir -p data/receipts
mkdir -p logs
mkdir -p temp

# Install project dependencies
print_info "Installing project dependencies..."
bun install

# Generate Prisma client
print_info "Generating Prisma client..."
bunx prisma generate

# Create database
print_info "Setting up database..."
bunx prisma db push

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    print_info "Creating .env file..."
    cat > .env << EOL
# WebSocket Server Configuration
WEBSOCKET_PORT=3002
JWT_SECRET=$(openssl rand -base64 32)

# Frontend URL (for OAuth redirects)
FRONTEND_URL=http://localhost:3000

# Mode: manual or automatic
MODE=manual

# Optional: Proxy configuration
# HTTP_PROXY=http://proxy.example.com:8080
# HTTPS_PROXY=http://proxy.example.com:8080

# Optional: Monitoring
# OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
# OTEL_SERVICE_NAME=itrader
EOL
    print_status ".env file created with default values"
else
    print_status ".env file already exists"
fi

# Create gmail-credentials.json template if it doesn't exist
if [ ! -f data/gmail-credentials.json ]; then
    print_info "Creating gmail-credentials.json template..."
    cat > data/gmail-credentials.json << EOL
{
  "installed": {
    "client_id": "YOUR_CLIENT_ID",
    "project_id": "YOUR_PROJECT_ID",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_secret": "YOUR_CLIENT_SECRET",
    "redirect_uris": ["http://localhost:3000/panel/gmail-callback"]
  }
}
EOL
    print_info "gmail-credentials.json template created. Please update with your OAuth credentials."
fi

# Install bcryptjs for password hashing
print_info "Installing bcryptjs..."
bun add bcryptjs @types/bcryptjs

# Create default admin account
print_info "Creating default admin account..."
echo -e "admin\nadmin" | bun run manage-webserver-accounts.ts create admin admin 2>/dev/null || print_info "Admin account may already exist"

# Create start script if it doesn't exist
if [ ! -f start.sh ]; then
    print_info "Creating start script..."
    cat > start.sh << 'EOL'
#!/bin/bash
echo "Starting Itrader..."
bun run src/app.ts
EOL
    chmod +x start.sh
    print_status "start.sh created"
fi

# Create manage-webserver-accounts.ts if it doesn't exist
if [ ! -f manage-webserver-accounts.ts ]; then
    print_info "Creating manage-webserver-accounts.ts..."
    cat > manage-webserver-accounts.ts << 'EOL'
#!/usr/bin/env bun
import { PrismaClient } from "./generated/prisma";
import bcrypt from "bcryptjs";
import readline from "readline";

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (prompt: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
};

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "create":
      const username = args[1];
      const role = args[2] || "operator";
      
      if (!username) {
        console.error("Usage: bun run manage-webserver-accounts.ts create <username> [role]");
        process.exit(1);
      }

      const password = await question(`Enter password for ${username}: `);
      const hashedPassword = await bcrypt.hash(password, 10);

      try {
        const user = await prisma.webServerUser.create({
          data: {
            username,
            password: hashedPassword,
            role,
            isActive: true,
          },
        });
        console.log(`User ${username} created successfully with role ${role}`);
      } catch (error: any) {
        if (error.code === 'P2002') {
          console.error(`User ${username} already exists`);
        } else {
          console.error("Error creating user:", error.message);
        }
      }
      break;

    case "list":
      const users = await prisma.webServerUser.findMany({
        select: {
          id: true,
          username: true,
          role: true,
          isActive: true,
          createdAt: true,
          lastLogin: true,
        },
      });
      console.table(users);
      break;

    case "reset":
      const resetUsername = args[1];
      if (!resetUsername) {
        console.error("Usage: bun run manage-webserver-accounts.ts reset <username>");
        process.exit(1);
      }

      const newPassword = await question(`Enter new password for ${resetUsername}: `);
      const newHashedPassword = await bcrypt.hash(newPassword, 10);

      try {
        await prisma.webServerUser.update({
          where: { username: resetUsername },
          data: { password: newHashedPassword },
        });
        console.log(`Password reset successfully for ${resetUsername}`);
      } catch (error) {
        console.error(`User ${resetUsername} not found`);
      }
      break;

    default:
      console.log("Usage:");
      console.log("  bun run manage-webserver-accounts.ts create <username> [role]");
      console.log("  bun run manage-webserver-accounts.ts list");
      console.log("  bun run manage-webserver-accounts.ts reset <username>");
      console.log("\nRoles: admin, operator, viewer");
  }

  rl.close();
  await prisma.$disconnect();
}

main().catch(console.error);
EOL
    chmod +x manage-webserver-accounts.ts
    print_status "manage-webserver-accounts.ts created"
fi

# Summary
echo ""
echo "====================================="
echo "   Installation Complete!            "
echo "====================================="
echo ""
print_status "All dependencies have been installed"
print_status "Database has been initialized"
print_status "Default directories have been created"
echo ""
echo "Next steps:"
echo "1. Update data/gmail-credentials.json with your Google OAuth credentials"
echo "2. Review and update .env file with your configuration"
echo "3. Run './start.sh' or 'bun run src/app.ts' to start the application"
echo ""
echo "Default admin credentials:"
echo "  Username: admin"
echo "  Password: admin"
echo ""
print_info "Please change the default admin password after first login!"
echo ""
print_info "To use Bun in current session, run: source ~/.bashrc (or restart terminal)"