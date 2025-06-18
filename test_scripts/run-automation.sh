#!/bin/bash

# Run automation directly without interactive menu
echo "Starting iTrader automation..."
echo "================================"
echo ""

# Run with bun instead of npx tsx
bun run src/app.ts

echo ""
echo "Automation completed."