#!/bin/bash
set -e

USER="user"
HOST="192.168.0.1"
REMOTE_DIR="/home/myname/Documents/baby-logger"
PASSWORD="mypasswd"

echo "🚧  Compiling frontend..."
npx tsc

echo "🍓  Cross-compiling for Raspberry Pi (linux/arm64)..."
# Changed from amd64 to arm64 for Raspberry Pi. 
# If your Pi is using 32-bit OS, change to GOARCH=arm GOARM=7
GOOS=linux GOARCH=arm64 go build -o baby-logger-linux .

echo "📦  Packaging for deployment..."
rm -rf deploy_stage
mkdir -p deploy_stage
cp baby-logger-linux deploy_stage/baby-logger
cp -r public deploy_stage/

# Create tarball
tar -czf deploy.tar.gz -C deploy_stage .

echo "🚀  Uploading deploy.tar.gz to $HOST..."
scp -o StrictHostKeyChecking=no deploy.tar.gz "$USER@$HOST:/tmp/baby-logger-deploy.tar.gz"

echo "🔄  Cleaning up and restarting service on remote..."
ssh -o StrictHostKeyChecking=no "$USER@$HOST" << EOF
    # Go to directory
    cd $REMOTE_DIR || exit 1
    
    # 1. Stop existing process
    pkill baby-logger || true
    
    # 2. Backup baby.log
    if [ -f baby.log ]; then
        cp baby.log /tmp/baby.log.bak
        echo "💾  Backed up baby.log"
    fi
    
    # 3. Clean directory (removes garbage files)
    # Be extremely careful with rm -rf *
    if [ "\$(pwd)" == "$REMOTE_DIR" ]; then
        rm -rf ./*
        echo "🧹  Cleaned directory"
    fi
    
    # 4. Restore baby.log
    if [ -f /tmp/baby.log.bak ]; then
        mv /tmp/baby.log.bak baby.log
        echo "💾  Restored baby.log"
    fi
    
    # 5. Extract new files
    tar -xzf /tmp/baby-logger-deploy.tar.gz -C $REMOTE_DIR
    rm /tmp/baby-logger-deploy.tar.gz
    
    # 6. Start service
    chmod +x baby-logger
    nohup ./baby-logger > server.log 2>&1 &
    
    echo "✅  Service restarted! PID: \$!"
EOF

echo "🧹  Cleaning up local artifacts..."
rm -rf deploy_stage deploy.tar.gz

echo "🎉  Deployment complete!"
