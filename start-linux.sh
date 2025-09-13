#!/bin/bash

# Zalagh Plancher - Linux Startup Script
# Run this script to start your application on Linux

echo "🚀 Starting Zalagh Plancher on Linux..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Installing Node.js 18..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL is not installed. Installing PostgreSQL..."
    sudo apt-get update
    sudo apt-get install -y postgresql postgresql-contrib
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Set environment variables
export NODE_ENV=production
export PORT=3000
export JWT_SECRET=zalagh-plancher-super-secret-key-2024
export PGHOST=localhost
export PGPORT=5432
export PGDATABASE=zalagh_plancher
export PGUSER=postgres
export PGPASSWORD=your-postgres-password
export PGSSL=false
export DEFAULT_ADMIN_PASSWORD=admin123
export GEMINI_API_KEY=your-gemini-api-key-here

# Create database if it doesn't exist
echo "🗄️ Setting up database..."
sudo -u postgres createdb zalagh_plancher 2>/dev/null || echo "Database already exists"

# Run database setup
echo "🔧 Setting up database schema..."
sudo -u postgres psql -d zalagh_plancher -f azure-compatible-setup.sql

# Start the application
echo "🌐 Starting application on port 3000..."
echo "📍 Your application will be available at: http://$(hostname -I | awk '{print $1}'):3000"
echo "📍 Or access from outside: http://YOUR_VM_IP:3000"

# Start the server
node server.js
