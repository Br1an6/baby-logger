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
	Type      string    `json:"type"`             // "milk", "wet", "bm"
	Amount    float64   `json:"amount,omitempty"` // For milk, in ounces
}

// StatsResponse represents the aggregated data returned to the client
type StatsResponse struct {
	TotalMilk   float64    `json:"total_milk"`
	DiaperWet   int        `json:"diaper_wet"`
	DiaperBM    int        `json:"diaper_bm"`
	Logs        []LogEntry `json:"logs"`
}

var (
	logFilePath = "baby.log"
	fileMu      sync.Mutex
)

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

// handleLog processes POST requests to record a new event
func handleLog(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var entry LogEntry
	if err := json.NewDecoder(r.Body).Decode(&entry); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Set timestamp if not provided (or overwrite to server time for consistency)
	entry.Timestamp = time.Now()

	if err := appendLog(entry); err != nil {
		log.Printf("Error writing log: %v", err)
		http.Error(w, "Failed to save log", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"status": "saved"})
}

// handleStats processes GET requests to retrieve logs and totals
func handleStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	durationStr := r.URL.Query().Get("duration") // "1h", "24h", "all"
	
	logs, err := readLogs()
	if err != nil {
		log.Printf("Error reading logs: %v", err)
		http.Error(w, "Failed to read logs", http.StatusInternalServerError)
		return
	}

	filteredLogs := []LogEntry{}
	now := time.Now()

	// Filter based on duration
	for _, entry := range logs {
		include := false
		switch durationStr {
		case "1h":
			if now.Sub(entry.Timestamp) <= time.Hour {
				include = true
			}
		case "24h":
			if now.Sub(entry.Timestamp) <= 24*time.Hour {
				include = true
			}
		case "all":
			include = true
		default:
			// Default to 24h if unspecified, or handle as error?
			// Requirement says "get last hour log and the past 24 hours and the entire logs"
			// Let's default to 24h for safety, or just All if unclear.
			// I'll default to all if empty, or strict if specified.
			if durationStr == "" {
				include = true
			} else {
				// if unknown duration, maybe ignore?
				// For now, let's treat unknown as "all" or specific logic.
				// But simpler: just check valid matches.
				include = true
			}
		}

		if include {
			filteredLogs = append(filteredLogs, entry)
		}
	}

	// Calculate totals
	stats := StatsResponse{
		Logs: filteredLogs,
	}

	for _, entry := range filteredLogs {
		switch entry.Type {
		case "milk":
			stats.TotalMilk += entry.Amount
		case "wet":
			stats.DiaperWet++
		case "bm":
			stats.DiaperBM++
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

// appendLog writes a log entry to the file safely
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

// readLogs reads all logs from the file
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

// handleDeleteLast removes the most recent log entry
func handleDeleteLast(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete && r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	fileMu.Lock()
	defer fileMu.Unlock()

	// Read all lines
	f, err := os.Open(logFilePath)
	if err != nil {
		if os.IsNotExist(err) {
			http.Error(w, "No logs to delete", http.StatusNotFound)
			return
		}
		http.Error(w, "Failed to read logs", http.StatusInternalServerError)
		return
	}
	
	var lines []string
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		lines = append(lines, scanner.Text())
	}
	f.Close()

	if len(lines) == 0 {
		http.Error(w, "Log file is empty", http.StatusNotFound)
		return
	}

	// Remove the last line
	lines = lines[:len(lines)-1]

	// Rewrite the file
	f, err = os.OpenFile(logFilePath, os.O_TRUNC|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		http.Error(w, "Failed to open log file for rewriting", http.StatusInternalServerError)
		return
	}
	defer f.Close()

	for _, line := range lines {
		if _, err := f.WriteString(line + "\n"); err != nil {
			http.Error(w, "Failed to write log file", http.StatusInternalServerError)
			return
		}
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
}
