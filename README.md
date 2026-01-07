# Baby Logger

![version](https://img.shields.io/badge/version-0.1.0-blue)

A simple self-hosted web service to track baby activities (Milk, Wet Diapers, BM Diapers ... etc).
Built with a **Golang** backend and **TypeScript** frontend. Please note that this has no Auth options. Please run this locally.

[UI Preview](https://raw.githack.com/Br1an6/baby-logger/main/public/index.html) (Static, no backend)

![alt tag](https://github.com/Br1an6/baby-logger/blob/main/img/baby-logger.png)

## Features
- **Milk Tracking**: Accumulate ounces (0.5, 1, 2) and record feedings.
- **Pump Tracking**: Track mother's pumped milk volume (0.5, 1, 2).
- **Breast Feeding**: Record breastfeeding duration for each side.
- **Diaper Tracking**: One-click recording for Wet, BM, or Both diapers.
- **Dark Mode**: Switch between light and dark themes (persisted in browser).
- **Statistics**: View totals and history for the last 1 hour, 24 hours, today, or All time.
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

You can configure the port using the `PORT` environment variable or the `-port` flag:

```bash
# Using environment variable
PORT=5000 go run main.go

# Using flag
go run main.go -port=5000
```

### 2. Using Makefile
You can also use the included `Makefile` to build and run the project:

- **Build**: `make build` (Compiles TypeScript and Go binary)
- **Run**: `make run` (Builds and runs the binary)
- **Clean**: `make clean` (Removes build artifacts)

To run on a custom port with make:
```bash
PORT=5000 make run
```

### 3. Usage
- **Dark Mode**: Tap the "🌓 Mode" button in the top right to toggle between light and dark themes.
- **Milk**: Tap "+ 0.5 oz", "+ 1.0 oz" etc. to sum up the amount. Click "Record Milk" to save.
- **Pump**: Tap "+ 0.5 oz", "+ 1.0 oz" etc. to sum up the pumped amount. Click "Record Pump" to save.
- **Breast Feeding**: Enter duration and select "Left Breast" or "Right Breast".
- **Diaper**: Tap "Wet", "BM", or "Both" to save immediately.
- **History**: Click "Last 1 Hr", "Last 24 Hrs", or "All Time" to see the summary and log list.
- **Manual Entry**: Use the "Manual Entry" section to backdate logs or add specific types.
- **Undo**: Use "Undo Last Entry" to remove the most recent record.

### 4. Development (Frontend)
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

### Option 1: Local Deployment (e.g., macOS)
1.  `make run`
2.  Access: http://localhost:4011

### Option 2: Remote Deployment (e.g., Raspberry Pi)
To deploy to a remote Linux ARM64 server (like `192.168.0.123`):

A sample deployment script is provided at [sample/deploy.sh](https://github.com/Br1an6/baby-logger/blob/main/sample/deploy.sh) for convenience. You can use it as a template to automate the cross-compilation and file upload process.

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

## TODO:
* Add Auth method
* Configuration flags for file size and file path
* Log rotation and cache size
