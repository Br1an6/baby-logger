.PHONY: all build run clean release

# Default target
all: build

# Build the application
# 1. Compile TypeScript
# 2. Build Go binary
build:
	npx tsc
	go build -o baby-logger .

# Cross-compile for multiple platforms
release:
	npx tsc
	mkdir -p release
	GOOS=linux GOARCH=amd64 go build -o release/baby-logger-linux-amd64 .
	GOOS=linux GOARCH=arm64 go build -o release/baby-logger-linux-arm64 .
	GOOS=darwin GOARCH=amd64 go build -o release/baby-logger-darwin-amd64 .
	GOOS=darwin GOARCH=arm64 go build -o release/baby-logger-darwin-arm64 .
	GOOS=windows GOARCH=amd64 go build -o release/baby-logger-windows-amd64.exe .
	GOOS=windows GOARCH=arm64 go build -o release/baby-logger-windows-arm64.exe .

# Run the application locally
run: build
	./baby-logger

# Clean build artifacts
clean:
	rm -f baby-logger
	rm -f public/app.js
	rm -f startup.log server_out.log gorun.log
	rm -rf release
