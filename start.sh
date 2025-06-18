#!/bin/bash

# Itrader startup script

echo "Itrader - P2P Trading Automation"
echo "================================"
echo ""
echo "Select startup option:"
echo "1) CLI - Manage accounts and settings"
echo "2) Run - Start automation"
echo "3) Exit"
echo ""
read -p "Enter your choice (1-3): " choice

case $choice in
    1)
        echo "Starting CLI..."
        bun run src/app.ts --cli
        ;;
    2)
        echo "Starting automation..."
        bun run src/app.ts
        ;;
    3)
        echo "Exiting..."
        exit 0
        ;;
    *)
        echo "Invalid choice. Exiting..."
        exit 1
        ;;
esac