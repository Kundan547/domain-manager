#!/bin/bash

# Domain Manager Deployment Script
# This script helps set up and deploy the Domain Manager application

set -e

echo "🚀 Domain Manager Deployment Script"
echo "=================================="

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

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp env.example .env
    echo "✅ .env file created. Please edit it with your configuration."
    echo "   You can run this script again after configuring .env"
    exit 0
fi

# Function to check if .env is properly configured
check_env() {
    if grep -q "your-super-secret-jwt-key" .env; then
        echo "⚠️  Warning: Default JWT secret detected. Please change it in .env file."
        return 1
    fi
    return 0
}

# Check environment configuration
if ! check_env; then
    echo "❌ Please configure your .env file before continuing."
    exit 1
fi

# Build and start services
echo "🔨 Building and starting services..."
docker-compose up -d --build

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check if services are running
echo "🔍 Checking service status..."
if docker-compose ps | grep -q "Up"; then
    echo "✅ Services are running successfully!"
    echo ""
    echo "🌐 Application URLs:"
    echo "   Frontend: http://localhost"
    echo "   Backend API: http://localhost:5000"
    echo "   Health Check: http://localhost:5000/health"
    echo ""
    echo "📊 To view logs: docker-compose logs -f"
    echo "🛑 To stop services: docker-compose down"
    echo ""
    echo "🎉 Domain Manager is now running!"
else
    echo "❌ Some services failed to start. Check logs with: docker-compose logs"
    exit 1
fi 