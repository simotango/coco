#!/bin/bash

# Zalagh Plancher - Linux Installation Script
# Run this script to install and setup your application on Linux

echo "🐧 Installing Zalagh Plancher on Linux..."

# Update system
echo "📦 Updating system packages..."
sudo apt-get update

# Install Node.js 18
echo "📦 Installing Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
echo "🗄️ Installing PostgreSQL..."
sudo apt-get install -y postgresql postgresql-contrib

# Install Docker (optional)
echo "🐳 Installing Docker..."
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
echo "🐳 Installing Docker Compose..."
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Make scripts executable
chmod +x start-linux.sh

echo "✅ Installation complete!"
echo ""
echo "🚀 To start your application:"
echo "   ./start-linux.sh"
echo ""
echo "🐳 Or with Docker:"
echo "   docker-compose up -d"
echo ""
echo "📍 Your application will be available at:"
echo "   http://$(hostname -I | awk '{print $1}'):3000"
