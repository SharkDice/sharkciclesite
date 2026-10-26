#!/bin/bash

# CoreProtect API Service Setup Script
# Run this on your Debian machine to set up the Node.js service

set -e

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🔧 CoreProtect API Service Setup"
echo "=================================="

# Configuration
SERVICE_NAME="coreprotect-api"
SERVICE_USER="shark"  # The user that runs the Minecraft server
SERVICE_DIR="/opt/coreprotect-api"
SERVICE_PORT="3001"

SERVICE_NODE="$(sudo -u "$SERVICE_USER" -H bash -lc 'command -v node' 2>/dev/null || true)"
if [ -z "$SERVICE_NODE" ]; then
  SERVICE_NODE="$(sudo -u "$SERVICE_USER" -H bash -lc 'find "$HOME/.nvm/versions/node" -type f -path "*/bin/node" -print 2>/dev/null | sort -V | tail -n 1' 2>/dev/null || true)"
fi
if [ -z "$SERVICE_NODE" ] || [ ! -x "$SERVICE_NODE" ]; then
  echo "Could not find Node.js for $SERVICE_USER. Ensure Node.js is installed and available to that user."
  exit 1
fi
SERVICE_NODE_DIR="$(dirname "$SERVICE_NODE")"
SERVICE_NPM="$SERVICE_NODE_DIR/npm"
if [ ! -x "$SERVICE_NPM" ]; then
  echo "Could not find npm beside $SERVICE_NODE."
  exit 1
fi

echo "📍 Creating service directory..."
sudo mkdir -p "$SERVICE_DIR"
sudo chown "$SERVICE_USER:$SERVICE_USER" "$SERVICE_DIR"

echo "📦 Copying service files..."
sudo "$SERVICE_NODE" --check "$SCRIPT_DIR/index.js"
sudo "$SERVICE_NODE" --check "$SCRIPT_DIR/server-activity.js"
sudo cp "$SCRIPT_DIR/package.json" "$SCRIPT_DIR/index.js" "$SCRIPT_DIR/server-activity.js" "$SERVICE_DIR/"
sudo chown "$SERVICE_USER:$SERVICE_USER" "$SERVICE_DIR/package.json" "$SERVICE_DIR/index.js" "$SERVICE_DIR/server-activity.js"

echo "🔎 Validating service JavaScript..."
sudo -u "$SERVICE_USER" "$SERVICE_NODE" --check "$SERVICE_DIR/index.js"
sudo -u "$SERVICE_USER" "$SERVICE_NODE" --check "$SERVICE_DIR/server-activity.js"

echo "📚 Installing dependencies..."
cd "$SERVICE_DIR"
sudo -u "$SERVICE_USER" env "PATH=$SERVICE_NODE_DIR:$PATH" "$SERVICE_NPM" install

echo "🔗 Creating systemd service..."
sudo tee /etc/systemd/system/${SERVICE_NAME}.service > /dev/null <<EOF
[Unit]
Description=CoreProtect Statistics API
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$SERVICE_DIR
ExecStart=$SERVICE_NODE $SERVICE_DIR/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

echo "✅ Enabling service..."
sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"

echo "🚀 Restarting service to load updated files..."
sudo systemctl restart "$SERVICE_NAME"

echo "🧪 Testing service..."
service_ready=false
for attempt in {1..30}; do
  if curl -fsS "http://localhost:$SERVICE_PORT/health" > /dev/null &&
    curl -fsS "http://localhost:$SERVICE_PORT/activity" > /dev/null; then
    service_ready=true
    break
  fi
  sleep 1
done

if [ "$service_ready" = true ]; then
  echo "✓ Service is running!"
  echo "📊 Stats available at: http://localhost:$SERVICE_PORT/stats"
  echo "👥 Activity available at: http://localhost:$SERVICE_PORT/activity"
else
  echo "⚠️  Service health/activity check failed. Check status and logs with:"
  echo "   sudo systemctl status $SERVICE_NAME"
  echo "   sudo journalctl -u $SERVICE_NAME -n 50 --no-pager"
  exit 1
fi

echo ""
echo "✨ Setup complete!"
echo "👥 Player activity is available at: http://localhost:$SERVICE_PORT/activity"
echo "📋 Service management:"
echo "   Start:   sudo systemctl start $SERVICE_NAME"
echo "   Stop:    sudo systemctl stop $SERVICE_NAME"
echo "   Status:  sudo systemctl status $SERVICE_NAME"
echo "   Logs:    sudo journalctl -u $SERVICE_NAME -f"
