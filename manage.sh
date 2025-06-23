#!/bin/bash
# Quick launcher for iTrader Server Manager

# Check if bun is installed
if ! command -v bun &> /dev/null; then
    echo "Error: Bun is not installed. Please run ./install.sh first"
    exit 1
fi

# Run the server manager
bun run server-manager.ts