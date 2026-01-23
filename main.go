package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
)

// LogEntry represents a single activity event
type LogEntry struct {
	Timestamp time.Time `json:"timestamp"`
	Type      string    `json:"type"`             // "milk", "wet", "bm", "breast"
	Amount    float64   `json:"amount,omitempty"` // For milk, in ounces
	Side      string    `json:"side,omitempty"`   // "L" or "R" for breast feeding
	Duration  int       `json:"duration,omitempty"` // For breast feeding, in minutes
}

var store *Store

// main is the entry point of the application.
// It sets up the HTTP server, defines the API endpoints, and starts listening on port 4011.
func main() {
	// Configuration Flags
	logPath := flag.String("log-path", "baby.log", "Path to the log file")
	maxSize := flag.Int("max-size", 0, "Max log file size in MB (0 for unlimited)")
	maxBackups := flag.Int("max-backups", 5, "Max number of rotated log files to keep")
	portStr := flag.String("port", "4011", "Port to run the server on")

	// Allow PORT env var to override default if flag not set (simplistic approach, or use flag default)
	if envPort := os.Getenv("PORT"); envPort != "" {
		// Use env port if provided
		// Note: flag.Parse() overwrites this if flag is present. 
		// Actually, standard is Env < Config File < Flag.
		// For simplicity, we stick to flags, but let's respect the env if flag is default.
		// However, standard `flag` usage is parsing first.
	}
	flag.Parse()

	// Initialize Store
	var err error
	store, err = NewStore(*logPath, *maxSize, *maxBackups)
	if err != nil {
		log.Fatalf("Failed to initialize log store: %v", err)
	}

	// Serve static files from the "public" directory
	fs := http.FileServer(http.Dir("./public"))
	http.Handle("/", fs)

	// API Endpoints
	http.HandleFunc("/api/log", handleLog)
	http.HandleFunc("/api/log/last", handleDeleteLast)
	http.HandleFunc("/api/stats", handleStats)

	fmt.Printf("Server starting on http://0.0.0.0:%s\n", *portStr)
	fmt.Printf("Logging to: %s (Max Size: %d MB, Backups: %d)\n", *logPath, *maxSize, *maxBackups)
	
	if err := http.ListenAndServe("0.0.0.0:"+*portStr, nil); err != nil {
		fmt.Printf("Error starting server: %v\n", err)
		log.Fatal(err)
	}
}


