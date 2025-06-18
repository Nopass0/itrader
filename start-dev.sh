#!/bin/bash

echo "🚀 Starting iTrader development environment..."
echo "📝 Backend (WebSocket API): http://localhost:3001"
echo "🎨 Frontend: http://localhost:3000"
echo "🔥 Hot reload enabled for both services"
echo ""

# Run the development script
exec bun run start-dev.ts