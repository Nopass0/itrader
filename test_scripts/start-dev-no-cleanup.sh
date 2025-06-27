#!/bin/bash

echo "Starting development server without cleanup..."
cd /home/user/projects/itrader_project

# Start backend
echo "Starting backend on port 3002..."
bun --hot run src/app.ts &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Start frontend
echo "Starting frontend on port 3000..."
cd frontend
npm run dev &
FRONTEND_PID=$!

echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo "Press Ctrl+C to stop both servers"

# Wait for either process to exit
wait $BACKEND_PID $FRONTEND_PID