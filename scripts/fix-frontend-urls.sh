#!/bin/bash

# Script to fix frontend WebSocket URLs

EXTERNAL_IP=$(curl -s https://api.ipify.org || echo "localhost")

echo "Fixing frontend configuration for external IP: $EXTERNAL_IP"

# Create or update .env.production.local in frontend
cat > frontend/.env.production.local << EOF
# Production environment with external IP
NEXT_PUBLIC_WS_URL=http://$EXTERNAL_IP:3001
NEXT_PUBLIC_API_URL=http://$EXTERNAL_IP:3001
EOF

echo "Frontend configuration updated!"
echo ""
echo "Now rebuild and restart the frontend:"
echo "cd frontend"
echo "npm run build"
echo "npm run start"