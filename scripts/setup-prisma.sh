#!/bin/bash

echo "Setting up Prisma for iTrader..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "Error: package.json not found. Please run this script from the project root."
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    bun install
fi

# Generate Prisma client
echo "Generating Prisma client..."
bunx prisma generate

# Run database migrations
echo "Running database migrations..."
bunx prisma migrate deploy

echo "Prisma setup complete!"