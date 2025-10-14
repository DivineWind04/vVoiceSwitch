#!/bin/bash

# vIVSR Deployment Script

echo "🚀 Starting vIVSR Web App Deployment"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Node.js version: $(node --version)"
echo "✅ npm version: $(npm --version)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the application
echo "🔨 Building application..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    
    echo ""
    echo "🎉 Deployment ready!"
    echo ""
    echo "To start the production server:"
    echo "  npm run start"
    echo ""
    echo "The app will be available at: http://localhost:3000"
    echo ""
    echo "📋 User Requirements:"
    echo "  • AFV service running on ws://localhost:9002"
    echo "  • Modern web browser with audio permissions"
    echo "  • Position data in /public/zoa_position.json"
    echo ""
    echo "🌐 UI Access Points:"
    echo "  • Main: http://localhost:3000"
    echo "  • VSCS: http://localhost:3000/vscs"
    echo "  • ETVS: http://localhost:3000/etvs"
    echo "  • STVS: http://localhost:3000/stvs"
    echo "  • IVSR: http://localhost:3000/ivsr"
    echo "  • RDVS: http://localhost:3000/rdvs"
else
    echo "❌ Build failed!"
    exit 1
fi