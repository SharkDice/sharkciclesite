#!/bin/bash

# CoreProtect API Service Setup Script
# Run this on your Debian machine to set up the Node.js service

set -e

echo "🔧 CoreProtect API Service Setup"
echo "=================================="

# Configuration
SERVICE_NAME="coreprotect-api"
SERVICE_USER="shark"  # The user that runs the Minecraft server
SERVICE_DIR="/opt/coreprotect-api"
SERVICE_PORT="3001"

echo "📍 Creating service directory..."
sudo mkdir -p $SERVICE_DIR
sudo chown $SERVICE_USER:$SERVICE_USER $SERVICE_DIR

echo "📦 Copying service files..."
sudo cp package.json $SERVICE_DIR/
sudo cp index.js $SERVICE_DIR/
sudo chown $SERVICE_USER:$SERVICE_USER $SERVICE_DIR/*

echo "📚 Installing dependencies..."
cd $SERVICE_DIR
sudo -u $SERVICE_USER npm install

echo "🔗 Creating systemd service..."
sudo tee /etc/systemd/system/${SERVICE_NAME}.service > /dev/null <<EOF
[Unit]
Description=CoreProtect Statistics API
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$SERVICE_DIR
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

echo "✅ Enabling service..."
sudo systemctl daemon-reload
sudo systemctl enable $SERVICE_NAME

echo "🚀 Starting service..."
sudo systemctl start $SERVICE_NAME

echo "⏳ Waiting for service to start..."
sleep 2

echo "🧪 Testing service..."
if curl -s http://localhost:$SERVICE_PORT/health > /dev/null; then
  echo "✓ Service is running!"
  echo "📊 Stats available at: http://localhost:$SERVICE_PORT/stats/top-blocks"
else
  echo "⚠️  Service may not be responding yet. Check status with:"
  echo "   sudo systemctl status $SERVICE_NAME"
fi

echo ""
echo "✨ Setup complete!"
echo "📋 Service management:"
echo "   Start:   sudo systemctl start $SERVICE_NAME"
echo "   Stop:    sudo systemctl stop $SERVICE_NAME"
echo "   Status:  sudo systemctl status $SERVICE_NAME"
echo "   Logs:    sudo journalctl -u $SERVICE_NAME -f"
