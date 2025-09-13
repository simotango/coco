#!/bin/bash

# Zalagh Plancher - Simple Ubuntu Setup
# Run this on your Ubuntu VM

echo "🐧 Setting up Zalagh Plancher on Ubuntu VM..."

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
echo "📦 Installing Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
echo "🗄️ Installing PostgreSQL..."
sudo apt install -y postgresql postgresql-contrib

# Install Git
sudo apt install -y git

# Clone your repository (replace with your GitHub URL)
echo "📥 Cloning repository..."
git clone https://github.com/YOUR_USERNAME/zalagh-plancher.git
cd zalagh-plancher

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Setup PostgreSQL
echo "🗄️ Setting up database..."
sudo -u postgres createdb zalagh_plancher
sudo -u postgres psql -d zalagh_plancher -c "CREATE USER zalaghadmin WITH PASSWORD 'admin123';"
sudo -u postgres psql -d zalagh_plancher -c "GRANT ALL PRIVILEGES ON DATABASE zalagh_plancher TO zalaghadmin;"

# Run database setup
sudo -u postgres psql -d zalagh_plancher -f azure-compatible-setup.sql

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

# Allow port 3000 in firewall
sudo ufw allow 3000

# Get VM IP
VM_IP=$(hostname -I | awk '{print $1}')

echo "✅ Setup complete!"
echo ""
echo "🚀 To start your application:"
echo "   cd zalagh-plancher"
echo "   node server.js"
echo ""
echo "📍 Your application will be available at:"
echo "   http://localhost:3000 (local)"
echo "   http://$VM_IP:3000 (public)"
echo ""
echo "🔐 Default login credentials:"
echo "   Admin: khalid@gmail.com / admin123"
echo "   Employee: ahmed@zalagh.com / admin123"
