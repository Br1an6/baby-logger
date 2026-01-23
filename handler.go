package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
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

// handleLog processes requests to the /api/log endpoint.
// POST: Records a new activity event.
// DELETE: Deletes specific log entries based on their timestamps.
// PUT: Updates a specific log entry.
// GET: Lists logs with pagination.
func handleLog(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPost {
		handleCreateLog(w, r)
	} else if r.Method == http.MethodDelete {
		handleBatchDeleteLog(w, r)
	} else if r.Method == http.MethodPut {
		handleUpdateLog(w, r)
	} else if r.Method == http.MethodGet {
		handleListLogs(w, r)
	} else {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// handleListLogs returns a paginated list of logs.
func handleListLogs(w http.ResponseWriter, r *http.Request) {
	pageStr := r.URL.Query().Get("page")
	limitStr := r.URL.Query().Get("limit")

	page := 1
	limit := 50

	if pageStr != "" {
		fmt.Sscanf(pageStr, "%d", &page)
	}
	if limitStr != "" {
		fmt.Sscanf(limitStr, "%d", &limit)
	}
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 50
	}

	logs, total := store.GetPage(page, limit)

	resp := map[string]interface{}{
		"logs":  logs,
		"total": total,
		"page":  page,
		"limit": limit,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// handleCreateLog processes the POST request to add a log entry.
func handleCreateLog(w http.ResponseWriter, r *http.Request) {
	var entry LogEntry
	if err := json.NewDecoder(r.Body).Decode(&entry); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Set timestamp if not provided
	if entry.Timestamp.IsZero() {
		entry.Timestamp = time.Now()
	}

	if err := store.Append(entry); err != nil {
		log.Printf("Error writing log: %v", err)
		http.Error(w, "Failed to save log", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"status": "saved"})
}

// handleUpdateLog processes the PUT request to update a log entry.
func handleUpdateLog(w http.ResponseWriter, r *http.Request) {
	// We expect the original timestamp in the query string to identify the record
	tsStr := r.URL.Query().Get("timestamp")
	if tsStr == "" {
		http.Error(w, "Missing timestamp parameter", http.StatusBadRequest)
		return
	}

	oldTimestamp, err := time.Parse(time.RFC3339, tsStr)
	if err != nil {
		// Try flexible parsing if needed, but RFC3339 is standard from JS toISOString
		http.Error(w, "Invalid timestamp format", http.StatusBadRequest)
		return
	}

	var newEntry LogEntry
	if err := json.NewDecoder(r.Body).Decode(&newEntry); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if err := store.Update(oldTimestamp, newEntry); err != nil {
		log.Printf("Error updating log: %v", err)
		http.Error(w, "Failed to update log: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "updated"})
}

// handleBatchDeleteLog processes the DELETE request to remove log entries.
func handleBatchDeleteLog(w http.ResponseWriter, r *http.Request) {
	var timestamps []time.Time
	if err := json.NewDecoder(r.Body).Decode(&timestamps); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if len(timestamps) == 0 {
		w.WriteHeader(http.StatusOK)
		return
	}

	// Get initial count to calculate deleted count
	initialCount := len(store.GetAll())

	if err := store.DeleteBatch(timestamps); err != nil {
		log.Printf("Error deleting logs: %v", err)
		http.Error(w, "Failed to delete logs", http.StatusInternalServerError)
		return
	}
	
	finalCount := len(store.GetAll())

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "deleted", "count": fmt.Sprintf("%d", initialCount-finalCount)})
}

// handleStats processes GET requests to retrieve aggregated statistics and log entries.
func handleStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	durationStr := r.URL.Query().Get("duration") // "1h", "24h", "today", "all"
	pageStr := r.URL.Query().Get("page")
	limitStr := r.URL.Query().Get("limit")

	page := 1
	limit := 50 // Default limit for stats view

	if pageStr != "" {
		fmt.Sscanf(pageStr, "%d", &page)
	}
	if limitStr != "" {
		fmt.Sscanf(limitStr, "%d", &limit)
	}
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 50
	}
	
	// Use In-Memory Store
	logs := store.GetAll()

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
			// Default to 24h if generic or empty, or maybe "today"? 
			// Original code defaulted to including everything if default. 
			// Let's stick to "all" if empty for consistency with original logic,
			// or better, default to "24h" if not specified? 
			// The original code: `if durationStr == "" { include = true }` -> ALL
			include = true
		}

		if include {
			filteredLogs = append(filteredLogs, entry)
		}
	}

	// Calculate totals on ALL matching logs
	stats := StatsResponse{}

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

	// Paginate the logs for the response
	// Sort newest first
	// Note: Store.GetAll returns in order of insertion (usually chronological).
	// We want newest first for display.
	// Let's reverse filteredLogs first.
	totalFiltered := len(filteredLogs)
	reversedLogs := make([]LogEntry, totalFiltered)
	for i, e := range filteredLogs {
		reversedLogs[totalFiltered-1-i] = e
	}
	
	// Slice for pagination
	start := (page - 1) * limit
	end := start + limit
	
	if start >= totalFiltered {
		stats.Logs = []LogEntry{}
	} else {
		if end > totalFiltered {
			end = totalFiltered
		}
		stats.Logs = reversedLogs[start:end]
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

// handleDeleteLast removes the most recent log entry.
func handleDeleteLast(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete && r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if err := store.DeleteLast(); err != nil {
		log.Printf("Error deleting last log: %v", err)
		http.Error(w, "Failed to delete last log: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
}
