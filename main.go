package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
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



var (
	logFilePath = "baby.log"
	fileMu      sync.Mutex
)

// main is the entry point of the application.
// It sets up the HTTP server, defines the API endpoints, and starts listening on port 4011.
func main() {
	// Serve static files from the "public" directory
	fs := http.FileServer(http.Dir("./public"))
	http.Handle("/", fs)

	// API Endpoints
	http.HandleFunc("/api/log", handleLog)
	http.HandleFunc("/api/log/last", handleDeleteLast)
	http.HandleFunc("/api/stats", handleStats)

	port := "4011"
	fmt.Printf("Server starting on http://0.0.0.0:%s\n", port)
	if err := http.ListenAndServe("0.0.0.0:"+port, nil); err != nil {
		fmt.Printf("Error starting server: %v\n", err)
		log.Fatal(err)
	}
}





// appendLog appends a new LogEntry to the persistent log file in a thread-safe manner.
// It marshals the entry to JSON and appends it as a new line in the file.
//
// Args:
//   entry: The LogEntry struct to be saved.
//
// Returns:
//   error: An error if opening or writing to the file fails, otherwise nil.
func appendLog(entry LogEntry) error {
	fileMu.Lock()
	defer fileMu.Unlock()

	f, err := os.OpenFile(logFilePath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	defer f.Close()

	data, err := json.Marshal(entry)
	if err != nil {
		return err
	}

	if _, err := f.Write(data); err != nil {
		return err
	}
	if _, err := f.WriteString("\n"); err != nil {
		return err
	}

	return nil
}

// readLogs reads and parses all LogEntry records from the persistent log file.
// It is thread-safe and ignores any corrupt lines in the file.
//
// Returns:
//   []LogEntry: A slice of LogEntry structs read from the file.
//   error: An error if opening or reading the file fails, otherwise nil.
func readLogs() ([]LogEntry, error) {
	fileMu.Lock()
	defer fileMu.Unlock()

	var logs []LogEntry

	// If file doesn't exist, return empty
	if _, err := os.Stat(logFilePath); os.IsNotExist(err) {
		return logs, nil
	}

	f, err := os.Open(logFilePath)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		var entry LogEntry
		if err := json.Unmarshal(scanner.Bytes(), &entry); err != nil {
			// Continue on corrupt lines or return error?
			// Let's log it and continue to be robust
			log.Printf("Skipping corrupt log line: %v", err)
			continue
		}
		logs = append(logs, entry)
	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}

	return logs, nil
}


