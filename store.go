package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

// Store manages log entries, file persistence, and rotation.
type Store struct {
	filePath   string
	maxSize    int64 // bytes. 0 means unlimited.
	maxBackups int
	
	mu      sync.RWMutex
	entries []LogEntry
}

// NewStore initializes a new Store.
func NewStore(path string, maxSizeMB int, maxBackups int) (*Store, error) {
	absPath, err := filepath.Abs(path)
	if err != nil {
		return nil, err
	}

	s := &Store{
		filePath:   absPath,
		maxSize:    int64(maxSizeMB) * 1024 * 1024,
		maxBackups: maxBackups,
		entries:    []LogEntry{},
	}

	if err := s.load(); err != nil {
		return nil, err
	}

	return s, nil
}

// load reads the log file into memory.
func (s *Store) load() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.entries = []LogEntry{}

	// If file doesn't exist, that's fine
	if _, err := os.Stat(s.filePath); os.IsNotExist(err) {
		return nil
	}

	f, err := os.Open(s.filePath)
	if err != nil {
		return err
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		var entry LogEntry
		if err := json.Unmarshal(scanner.Bytes(), &entry); err != nil {
			continue // Skip corrupt lines
		}
		s.entries = append(s.entries, entry)
	}

	return scanner.Err()
}

// Append adds a new entry, writes it to disk, and handles rotation.
func (s *Store) Append(entry LogEntry) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Check rotation
	if s.maxSize > 0 {
		fi, err := os.Stat(s.filePath)
		if err == nil && fi.Size() >= s.maxSize {
			if err := s.rotateLocked(); err != nil {
				return fmt.Errorf("rotation failed: %v", err)
			}
		}
	}

	// Append to file
	f, err := os.OpenFile(s.filePath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	
data, err := json.Marshal(entry)
	if err != nil {
		f.Close()
		return err
	}

	if _, err := f.Write(data); err != nil {
		f.Close()
		return err
	}
	if _, err := f.WriteString("\n"); err != nil {
		f.Close()
		return err
	}
	f.Close()

	// Append to memory
	s.entries = append(s.entries, entry)
	return nil
}

// rotateLocked performs log rotation. Caller must hold lock.
func (s *Store) rotateLocked() error {
	// Create backup name: baby.log.2026-01-23T14-30-00
	timestamp := time.Now().Format("2006-01-02T15-04-05")
	backupName := fmt.Sprintf("%s.%s", s.filePath, timestamp)

	// Rename current file
	if err := os.Rename(s.filePath, backupName); err != nil {
		return err
	}

	// Clean up old backups if needed
	if s.maxBackups > 0 {
		if err := s.pruneBackups(); err != nil {
			// Log error but don't fail the rotation
			fmt.Printf("Error pruning backups: %v\n", err)
		}
	}

	// Clear memory? 
	// If we rotate, the new file is empty.
	// But we might want to keep history in memory for stats.
	// For now, let's keep history in memory so stats don't break immediately.
	// But if the app restarts, it will only load the new empty file.
	// This is consistent with standard log rotation.
	
	// If we want "cache" to reflect *current file only*, we should clear s.entries.
	// If we want "cache" to reflect *session history*, we keep it.
	// Let's clear it to stay consistent with the "File is the Source of Truth" philosophy.
	s.entries = []LogEntry{}

	return nil
}

// pruneBackups removes old backup files.
func (s *Store) pruneBackups() error {
	dir := filepath.Dir(s.filePath)
	base := filepath.Base(s.filePath)
	prefix := base + "."

	files, err := os.ReadDir(dir)
	if err != nil {
		return err
	}

	var backups []string
	for _, f := range files {
		if !f.IsDir() && strings.HasPrefix(f.Name(), prefix) {
			backups = append(backups, filepath.Join(dir, f.Name()))
		}
	}

	// Sort by name (which includes timestamp, so chronological)
	sort.Strings(backups)

	// Remove oldest if too many
	if len(backups) > s.maxBackups {
		toRemove := len(backups) - s.maxBackups
		for i := 0; i < toRemove; i++ {
			os.Remove(backups[i])
		}
	}

	return nil
}

// GetPage returns a specific page of logs, sorted newest first.
// page is 1-based.
func (s *Store) GetPage(page, pageSize int) ([]LogEntry, int) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	total := len(s.entries)
	if total == 0 {
		return []LogEntry{}, 0
	}

	// We want newest first, so we traverse s.entries backwards.
	// Logic:
	// Page 1: indices [total-1, total-pageSize]
	// Start Index (from end): (page-1) * pageSize
	// End Index (from end): page * pageSize

	startFromEnd := (page - 1) * pageSize
	if startFromEnd >= total {
		return []LogEntry{}, total
	}

	endFromEnd := startFromEnd + pageSize
	if endFromEnd > total {
		endFromEnd = total
	}

	// Calculate actual indices in the slice
	// s.entries[total-1] is the first item (newest)
	// s.entries[total-1 - startFromEnd] is the start
	
	var result []LogEntry
	for i := startFromEnd; i < endFromEnd; i++ {
		// Index from start of slice
		idx := total - 1 - i
		result = append(result, s.entries[idx])
	}

	return result, total
}

// GetAll returns a copy of all entries.
func (s *Store) GetAll() []LogEntry {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	// Return a copy to be safe
	cpy := make([]LogEntry, len(s.entries))
	copy(cpy, s.entries)
	return cpy
}

// DeleteBatch removes entries matching the given timestamps.
func (s *Store) DeleteBatch(timestamps []time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	toDelete := make(map[time.Time]bool)
	for _, t := range timestamps {
		toDelete[t.UTC()] = true
		toDelete[t.Local()] = true
	}

	var kept []LogEntry
	for _, e := range s.entries {
		if !toDelete[e.Timestamp] && !toDelete[e.Timestamp.UTC()] && !toDelete[e.Timestamp.Local()] {
			kept = append(kept, e)
		}
	}

	// Rewrite file
	f, err := os.OpenFile(s.filePath, os.O_TRUNC|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	defer f.Close()

	for _, entry := range kept {
		data, _ := json.Marshal(entry)
		if _, err := f.Write(data); err != nil {
			return err
		}
		if _, err := f.WriteString("\n"); err != nil {
			return err
		}
	}

	s.entries = kept
	return nil
}

// DeleteLast removes the last entry.
func (s *Store) DeleteLast() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if len(s.entries) == 0 {
		return fmt.Errorf("empty log")
	}

	s.entries = s.entries[:len(s.entries)-1]

	// Rewrite file
	f, err := os.OpenFile(s.filePath, os.O_TRUNC|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	defer f.Close()

	for _, entry := range s.entries {
		data, _ := json.Marshal(entry)
		if _, err := f.Write(data); err != nil {
			return err
		}
		if _, err := f.WriteString("\n"); err != nil {
			return err
		}
	}

	return nil
}

// Update modifies an existing entry identified by oldTimestamp.
func (s *Store) Update(oldTimestamp time.Time, newEntry LogEntry) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Find index
	idx := -1
	target := oldTimestamp.UTC()
	// We also check Local because of how DeleteBatch does it, to be safe
	targetLocal := oldTimestamp.Local()

	for i, e := range s.entries {
		if e.Timestamp.Equal(target) || e.Timestamp.Equal(targetLocal) {
			idx = i
			break
		}
	}

	if idx == -1 {
		return fmt.Errorf("entry not found")
	}

	// Update in memory
	s.entries[idx] = newEntry

	// Rewrite file
	f, err := os.OpenFile(s.filePath, os.O_TRUNC|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	defer f.Close()

	for _, entry := range s.entries {
		data, _ := json.Marshal(entry)
		if _, err := f.Write(data); err != nil {
			return err
		}
		if _, err := f.WriteString("\n"); err != nil {
			return err
		}
	}

	return nil
}
