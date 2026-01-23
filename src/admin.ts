// Log Entry Interface (matching app.ts)
interface LogEntry {
    type: string;
    amount?: number;
    side?: string;
    duration?: number;
    timestamp?: string; // ISO string
}

// Fetch all logs
async function loadAllLogs() {
    try {
        const res = await fetch('/api/stats?duration=all');
        if (!res.ok) throw new Error("Failed to load logs");
        const data = await res.json();
        renderAdminTable(data.logs || []);
    } catch (err) {
        console.error(err);
        alert("Failed to load logs.");
    }
}

// Render logs in a table
function renderAdminTable(logs: LogEntry[]) {
    const tbody = document.getElementById('log-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    // Sort descending
    logs.sort((a, b) => new Date(b.timestamp!).getTime() - new Date(a.timestamp!).getTime());

    logs.forEach((log, index) => {
        const tr = document.createElement('tr');
        const date = new Date(log.timestamp!);
        const localTime = date.toLocaleString();
        
        let details = "";
        if (log.type === 'milk') details = `${log.amount} oz`;
        else if (log.type === 'pump') details = `${log.amount} oz`;
        else if (log.type === 'breast') details = `${log.side} side, ${log.duration} min`;
        else if (log.type === 'wet') details = "Wet";
        else if (log.type === 'bm') details = "BM";
        else if (log.type === 'wet+bm') details = "Wet + BM";

        tr.innerHTML = `
            <td><input type="checkbox" class="log-checkbox" value="${log.timestamp}"></td>
            <td>${localTime}</td>
            <td>${log.type}</td>
            <td>${details}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Delete Selected
async function deleteSelected() {
    const checkboxes = document.querySelectorAll('.log-checkbox:checked') as NodeListOf<HTMLInputElement>;
    const timestamps: string[] = [];
    checkboxes.forEach(cb => timestamps.push(cb.value));

    if (timestamps.length === 0) {
        alert("No logs selected.");
        return;
    }

    if (!confirm(`Are you sure you want to delete ${timestamps.length} entries?`)) return;

    try {
        // Convert ISO strings back to Date objects if needed by the backend, 
        // but the backend expects JSON array of timestamps (strings in JSON).
        const res = await fetch('/api/log', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(timestamps) // ["2026...", ...]
        });

        if (!res.ok) throw new Error("Failed to delete");
        
        const result = await res.json();
        alert(`Deleted ${result.count || timestamps.length} entries.`);
        loadAllLogs();
    } catch (err) {
        console.error(err);
        alert("Error deleting logs: " + err);
    }
}

// Toggle Select All
function toggleSelectAll(source: HTMLInputElement) {
    const checkboxes = document.querySelectorAll('.log-checkbox') as NodeListOf<HTMLInputElement>;
    checkboxes.forEach(cb => cb.checked = source.checked);
}

// Initialize
document.addEventListener('DOMContentLoaded', loadAllLogs);
