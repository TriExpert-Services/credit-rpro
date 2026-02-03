#!/bin/bash

# Credit Repair SaaS - Quick Deploy Script
# This script helps you quickly deploy the application

set -e

echo "🚀 Credit Repair SaaS - Deployment Script"
echo "=========================================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "✅ Docker and Docker Compose are installed"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from .env.example..."
    cp .env.example .env
    echo "📝 Please edit the .env file with your configuration before deploying."
    echo "   Run: nano .env"
    echo ""
    read -p "Press Enter after you've configured .env file..."
fi

echo "🔍 Current configuration:"
echo "------------------------"
grep -E "^(POSTGRES_USER|POSTGRES_DB|NODE_ENV|VITE_API_URL)=" .env | while IFS= read -r line; do
    echo "  $line"
done
echo ""

read -p "❓ Is this configuration correct? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Please edit .env file and run this script again."
    exit 1
fi

echo ""
echo "🏗️  Building and starting services..."
echo "------------------------------------"

# Stop any existing containers
docker-compose down 2>/dev/null || true

# Build and start services
docker-compose up -d --build

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check service health
echo ""
echo "🔍 Service Status:"
echo "----------------"
docker-compose ps

echo ""
echo "📊 Database initialization:"
echo "-------------------------"
docker-compose logs postgres | grep "database system is ready to accept connections" && echo "✅ PostgreSQL is ready" || echo "⚠️  PostgreSQL might still be initializing..."

echo ""
echo "🌐 Testing backend API..."
sleep 5
if curl -s http://localhost:5000/health > /dev/null; then
    echo "✅ Backend API is responding"
else
    echo "⚠️  Backend API is not responding yet. Check logs with: docker-compose logs backend"
fi

echo ""
echo "✅ Deployment complete!"
echo "====================="
echo ""
echo "🌐 Access your application:"
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:5000"
echo "  Nginx:    http://localhost:80"
echo ""
echo "👤 Default admin credentials:"
echo "  Email:    admin@creditrepair.com"
echo "  Password: Admin123!"
echo ""
echo "⚠️  IMPORTANT: Change the admin password immediately!"
echo ""
echo "📝 Useful commands:"
echo "  View logs:        docker-compose logs -f"
echo "  Stop services:    docker-compose down"
echo "  Restart:          docker-compose restart"
echo "  View database:    docker-compose exec postgres psql -U creditrepair -d creditrepair_db"
echo ""
echo "🎉 Happy credit repairing!"
