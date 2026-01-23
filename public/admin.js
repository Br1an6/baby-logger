var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// Fetch all logs
function loadAllLogs() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const res = yield fetch('/api/stats?duration=all');
            if (!res.ok)
                throw new Error("Failed to load logs");
            const data = yield res.json();
            renderAdminTable(data.logs || []);
        }
        catch (err) {
            console.error(err);
            alert("Failed to load logs.");
        }
    });
}
// Render logs in a table
function renderAdminTable(logs) {
    const tbody = document.getElementById('log-table-body');
    if (!tbody)
        return;
    tbody.innerHTML = '';
    // Sort descending
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    logs.forEach((log, index) => {
        const tr = document.createElement('tr');
        const date = new Date(log.timestamp);
        const localTime = date.toLocaleString();
        let details = "";
        if (log.type === 'milk')
            details = `${log.amount} oz`;
        else if (log.type === 'pump')
            details = `${log.amount} oz`;
        else if (log.type === 'breast')
            details = `${log.side} side, ${log.duration} min`;
        else if (log.type === 'wet')
            details = "Wet";
        else if (log.type === 'bm')
            details = "BM";
        else if (log.type === 'wet+bm')
            details = "Wet + BM";
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
function deleteSelected() {
    return __awaiter(this, void 0, void 0, function* () {
        const checkboxes = document.querySelectorAll('.log-checkbox:checked');
        const timestamps = [];
        checkboxes.forEach(cb => timestamps.push(cb.value));
        if (timestamps.length === 0) {
            alert("No logs selected.");
            return;
        }
        if (!confirm(`Are you sure you want to delete ${timestamps.length} entries?`))
            return;
        try {
            // Convert ISO strings back to Date objects if needed by the backend, 
            // but the backend expects JSON array of timestamps (strings in JSON).
            const res = yield fetch('/api/log', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(timestamps) // ["2026...", ...]
            });
            if (!res.ok)
                throw new Error("Failed to delete");
            const result = yield res.json();
            alert(`Deleted ${result.count || timestamps.length} entries.`);
            loadAllLogs();
        }
        catch (err) {
            console.error(err);
            alert("Error deleting logs: " + err);
        }
    });
}
// Toggle Select All
function toggleSelectAll(source) {
    const checkboxes = document.querySelectorAll('.log-checkbox');
    checkboxes.forEach(cb => cb.checked = source.checked);
}
// Initialize
document.addEventListener('DOMContentLoaded', loadAllLogs);
