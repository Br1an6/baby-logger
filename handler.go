package main

import (
	"bufio"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"
)

// StatsResponse represents the aggregated data returned to the client
type StatsResponse struct {
	TotalMilk       float64    `json:"total_milk"`
	TotalPumped     float64    `json:"total_pumped"`
	TotalBreastTime int        `json:"total_breast_time"`
	DiaperWet       int        `json:"diaper_wet"`
	DiaperBM        int        `json:"diaper_bm"`
	Logs            []LogEntry `json:"logs"`
}

// handleLog processes POST requests to record a new activity event.
// It decodes the JSON body into a LogEntry, sets the timestamp if missing, and appends it to the log file.
//
// Args:
//   w: The http.ResponseWriter to write the response to.
//   r: The *http.Request containing the request details and body.
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

	// Set timestamp if not provided
	if entry.Timestamp.IsZero() {
		entry.Timestamp = time.Now()
	}

	if err := appendLog(entry); err != nil {
		log.Printf("Error writing log: %v", err)
		http.Error(w, "Failed to save log", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"status": "saved"})
}

// handleStats processes GET requests to retrieve aggregated statistics and log entries.
// It filters logs based on the "duration" query parameter (1h, 24h, today, all) and calculates totals.
//
// Args:
//   w: The http.ResponseWriter to write the response to.
//   r: The *http.Request containing the query parameters.
func handleStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	durationStr := r.URL.Query().Get("duration") // "1h", "24h", "today", "all"
	
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
		case "today":
			// Check if same year, month, and day
			y1, m1, d1 := now.Date()
			y2, m2, d2 := entry.Timestamp.Local().Date()
			if y1 == y2 && m1 == m2 && d1 == d2 {
				include = true
			}
		case "all":
			include = true
		default:
			if durationStr == "" {
				include = true
			} else {
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
		case "pump":
			stats.TotalPumped += entry.Amount
		case "breast":
			stats.TotalBreastTime += entry.Duration
		case "wet":
			stats.DiaperWet++
		case "bm":
			stats.DiaperBM++
		case "wet+bm":
			stats.DiaperWet++
			stats.DiaperBM++
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

// handleDeleteLast removes the most recent log entry from the persistent file.
// It reads all lines, removes the last one, and rewrites the file.
//
// Args:
//   w: The http.ResponseWriter to write the response to.
//   r: The *http.Request.
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
