.PHONY: all build run clean

# Default target
all: build

# Build the application
# 1. Compile TypeScript
# 2. Build Go binary
build:
	npx tsc
	go build -o baby-logger .

# Run the application locally
run: build
	./baby-logger

# Clean build artifacts
clean:
	rm -f baby-logger
	rm -f public/app.js
	rm -f startup.log server_out.log gorun.log
