#!/bin/bash

echo "🔪 Killing all Node.js-related processes..."

# Kill processes by name
echo "📋 Killing processes by name..."
for process in bun node npm npx next tsx ts-node yarn pnpm; do
    if pgrep -f "$process" > /dev/null; then
        echo "  • Killing $process processes..."
        pkill -f "$process" 2>/dev/null
    fi
done

# Kill processes on specific ports
echo -e "\n🔌 Killing processes using ports 3000-3002..."
for port in 3000 3001 3002; do
    echo "  • Checking port $port..."
    
    # Try lsof first (macOS/Linux)
    if command -v lsof > /dev/null; then
        lsof -ti:$port | xargs -r kill -9 2>/dev/null
    fi
    
    # Try fuser as backup (Linux)
    if command -v fuser > /dev/null; then
        fuser -k $port/tcp 2>/dev/null
    fi
    
    # Try netstat + kill (works on most systems)
    if command -v netstat > /dev/null; then
        netstat -tlnp 2>/dev/null | grep ":$port " | awk '{print $7}' | cut -d'/' -f1 | xargs -r kill -9 2>/dev/null
    fi
done

# Wait a moment for processes to die
sleep 1

# Verify all processes are killed
echo -e "\n🔍 Verifying cleanup..."
all_clear=true

# Check for running processes
for process in bun node npm npx next tsx ts-node yarn pnpm; do
    if pgrep -f "$process" > /dev/null; then
        echo "  ❌ $process is still running"
        all_clear=false
    fi
done

# Check ports
for port in 3000 3001 3002; do
    if lsof -ti:$port > /dev/null 2>&1; then
        echo "  ❌ Port $port is still in use"
        all_clear=false
    else
        echo "  ✅ Port $port is free"
    fi
done

if [ "$all_clear" = true ]; then
    echo -e "\n✨ All processes killed successfully!"
else
    echo -e "\n⚠️  Some processes may still be running. Try running with sudo:"
    echo "  sudo bash $0"
fi