#!/bin/bash

# Simple server start script
cd zalagh-plancher

# Set environment variables
export NODE_ENV=production
export PORT=3000
export JWT_SECRET=zalagh-plancher-super-secret-key-2024
export PGHOST=localhost
export PGPORT=5432
export PGDATABASE=zalagh_plancher
export PGUSER=zalaghadmin
export PGPASSWORD=admin123
export PGSSL=false
export DEFAULT_ADMIN_PASSWORD=admin123
export GEMINI_API_KEY=your-gemini-api-key-here

# Get VM IP
VM_IP=$(hostname -I | awk '{print $1}')

echo "🚀 Starting Zalagh Plancher server..."
echo "📍 Local: http://localhost:3000"
echo "📍 Public: http://$VM_IP:3000"
echo ""
echo "Press Ctrl+C to stop the server"

# Start the server
node server.js
