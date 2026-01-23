# Configuration
$User = "brian"
$HostIP = "192.168.0.61"
$RemoteDir = "/home/brian/Documents/baby-logger"
$LocalArtifact = "deploy.zip"

Write-Host "🚧  Compiling frontend..." -ForegroundColor Cyan
cmd /c "npx tsc"

Write-Host "🍓  Cross-compiling for Raspberry Pi (linux/arm64)..." -ForegroundColor Cyan
$env:GOOS = "linux"
$env:GOARCH = "arm64"
go build -o baby-logger-linux .
$env:GOOS = $null
$env:GOARCH = $null

Write-Host "📦  Packaging for deployment..." -ForegroundColor Cyan
if (Test-Path deploy_stage) { Remove-Item -Recurse -Force deploy_stage }
New-Item -ItemType Directory -Force -Path deploy_stage | Out-Null

Copy-Item baby-logger-linux -Destination deploy_stage/baby-logger
Copy-Item -Recurse public -Destination deploy_stage/

# Remove old archive
if (Test-Path $LocalArtifact) { Remove-Item $LocalArtifact }

# Create Zip
Compress-Archive -Path deploy_stage/* -DestinationPath $LocalArtifact

Write-Host "🚀  Uploading $LocalArtifact to $HostIP..." -ForegroundColor Cyan
Write-Host "Note: You will be prompted for your password ($User)." -ForegroundColor Yellow
# This will prompt for password if keys aren't set up
scp $LocalArtifact "${User}@${HostIP}:/tmp/${LocalArtifact}"

Write-Host "🔄  Cleaning up and restarting service on remote..." -ForegroundColor Cyan
$RemoteCommands = @"
    # Ensure directory exists
    mkdir -p $RemoteDir
    cd $RemoteDir || exit 1
    
    # 1. Stop existing process
    pkill baby-logger || true
    
    # 2. Backup logs
    mkdir -p /tmp/backup_logs
    cp baby.log* /tmp/backup_logs/ 2>/dev/null || true
    echo "💾  Backed up log files"
    
    # 3. Clean directory
    if [ "\$(pwd)" == "$RemoteDir" ]; then
        rm -rf ./*
        echo "🧹  Cleaned directory"
    fi
    
    # 4. Restore logs
    cp -r /tmp/backup_logs/* . 2>/dev/null || true
    rm -rf /tmp/backup_logs
    
    # 5. Extract new files
    # Check for unzip, if not found try python
    if command -v unzip >/dev/null 2>&1; then
        unzip -o /tmp/$LocalArtifact -d .
    else
        python3 -c "import zipfile; import sys; zipfile.ZipFile('/tmp/$LocalArtifact').extractall('.')"
    fi
    rm /tmp/$LocalArtifact
    
    # 6. Start service
    chmod +x baby-logger
    nohup ./baby-logger > server.log 2>&1 &
    PID=$!
    
    echo "✅  Service restarted! PID: $PID"
    echo "⏳  Waiting for server to initialize..."
    sleep 2
    
    echo "📝  Last 20 lines of server.log:"
    echo "--------------------------------"
    tail -n 20 server.log
    echo "--------------------------------"
"@

# Execute remote commands
ssh "${User}@${HostIP}" $RemoteCommands

Write-Host "🧹  Cleaning up local artifacts..." -ForegroundColor Cyan
Remove-Item -Recurse -Force deploy_stage
Remove-Item $LocalArtifact
Remove-Item baby-logger-linux

Write-Host "🎉  Deployment complete!" -ForegroundColor Green
