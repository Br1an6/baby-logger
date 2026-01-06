# Baby Logger

A simple self-hosted web service to track baby activities (Milk, Wet Diapers, BM Diapers).
Built with a **Golang** backend and **TypeScript** frontend. Please note that this has no Auth options. Please run this locally.

## Features
- **Milk Tracking**: Accumulate ounces (0.5, 1, 2) and record.
- **Diaper Tracking**: One-click recording for Wet and BM diapers.
- **Statistics**: View totals and history for the last 1 hour, 24 hours, or All time.
- **Data Persistence**: Data is saved to a local `baby.log` file in JSON Lines format.

## Prerequisites
- **Go** (1.18+)
- **Node.js & npm** (only for rebuilding the frontend)

## Getting Started

### 1. Run the Server
The frontend has already been compiled to `public/app.js`. You can run the server immediately:

```bash
go run main.go
```

Open your browser to: **http://localhost:4011**

### 2. Usage
- **Milk**: Tap "+ 0.5 oz", "+ 1.0 oz" etc. to sum up the amount. Click "Record Milk" to save.
- **Diaper**: Tap "Wet Diaper" or "BM Diaper" to save immediately.
- **History**: Click "Last 1 Hr", "Last 24 Hrs", or "All Time" to see the summary and log list.

### 3. Development (Frontend)
If you want to modify the TypeScript code in `src/app.ts`:

1.  Install dependencies:
    ```bash
    npm install
    ```
2.  Compile TypeScript:
    ```bash
    npx tsc
    ```
    (This updates `public/app.js`)

## Deployment

### Option 1: Local Deployment (macOS)
1.  Build: `go build -o baby-logger`
2.  Run: `./baby-logger`
3.  Access: http://localhost:4011

### Option 2: Remote Deployment (e.g., Raspberry Pi)
To deploy to a remote Linux ARM64 server (like `192.168.0.123`):

1.  **Cross-Compile**:
    ```bash
    GOOS=linux GOARCH=arm64 go build -o baby-logger-linux-arm64
    ```
2.  **Upload Files**:
    Copy the binary and `public/` folder to the server:
    ```bash
    scp baby-logger-linux-arm64 user@host:~/baby-logger/baby-logger
    scp -r public user@host:~/baby-logger/
    ```
3.  **Run on Server**:
    SSH into the server and run:
    ```bash
    chmod +x baby-logger
    nohup ./baby-logger > server.log 2>&1 &
    ```
4.  **Access**: `http://<server-ip>:4011`

## Data
All data is stored in `baby.log` in the running directory. Back up this file to save your history.

![alt tag](https://github.com/Br1an6/baby-logger/blob/main/img/baby-logger.png)


## TODO:
* Add Auth method
* Configuration flags for port, file size and file path
* Log rotation and cache size
* Release files