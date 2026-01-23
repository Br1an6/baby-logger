// Log Entry Interface
interface LogEntry {
    type: string;
    amount?: number;
    side?: string;
    duration?: number;
    timestamp?: string; // ISO string
}

let currentPage = 1;
let pageSize = 50;
let totalLogs = 0;

// Fetch logs with pagination
async function loadLogs() {
    try {
        const res = await fetch(`/api/log?page=${currentPage}&limit=${pageSize}`);
        if (!res.ok) throw new Error("Failed to load logs");
        const data = await res.json();
        
        totalLogs = data.total || 0;
        const logs = data.logs || [];
        
        renderAdminTable(logs);
        updatePaginationControls();
    } catch (err) {
        console.error(err);
        alert("Failed to load logs.");
    }
}

// Update Pagination UI
function updatePaginationControls() {
    const totalPages = Math.ceil(totalLogs / pageSize);
    const pageInfo = document.getElementById('page-info');
    const totalInfo = document.getElementById('total-info');
    const btnPrev = document.getElementById('btn-prev') as HTMLButtonElement;
    const btnNext = document.getElementById('btn-next') as HTMLButtonElement;

    if (pageInfo) pageInfo.innerText = `Page ${currentPage} of ${totalPages || 1}`;
    if (totalInfo) totalInfo.innerText = `(${totalLogs} total)`;

    if (btnPrev) btnPrev.disabled = currentPage <= 1;
    if (btnNext) btnNext.disabled = currentPage >= totalPages;
}

// Change Page
function changePage(delta: number) {
    currentPage += delta;
    loadLogs();
}

// Change Page Size
function changePageSize() {
    const select = document.getElementById('page-size') as HTMLSelectElement;
    pageSize = parseInt(select.value);
    currentPage = 1;
    loadLogs();
}


// Render logs in a table
function renderAdminTable(logs: LogEntry[]) {
    const tbody = document.getElementById('log-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    // Logs are already sorted newest first from backend
    logs.forEach((log) => {
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
            <td><button class="btn-edit">Edit</button></td>
        `;
        
        const editBtn = tr.querySelector('.btn-edit') as HTMLButtonElement;
        editBtn.onclick = () => openEditModal(log);

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
        const res = await fetch('/api/log', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(timestamps)
        });

        if (!res.ok) throw new Error("Failed to delete");
        
        const result = await res.json();
        alert(`Deleted ${result.count || timestamps.length} entries.`);
        
        // Reload current page. If page is now empty, go back one if possible?
        // Simple reload is fine for now.
        loadLogs();
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

// Edit Modal Functions
function openEditModal(log: LogEntry) {
    const modal = document.getElementById('edit-modal');
    if (!modal) return;
    
    (document.getElementById('edit-original-timestamp') as HTMLInputElement).value = log.timestamp!;
    
    const date = new Date(log.timestamp!);
    const offset = date.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(date.getTime() - offset)).toISOString().slice(0, 16);
    (document.getElementById('edit-time') as HTMLInputElement).value = localISOTime;

    const typeSelect = document.getElementById('edit-type') as HTMLSelectElement;
    typeSelect.value = log.type;

    (document.getElementById('edit-amount') as HTMLInputElement).value = log.amount ? log.amount.toString() : '';
    (document.getElementById('edit-side') as HTMLSelectElement).value = log.side || 'L';
    (document.getElementById('edit-duration') as HTMLInputElement).value = log.duration ? log.duration.toString() : '';

    toggleEditFields();
    modal.style.display = 'flex';
}

function closeEditModal() {
    const modal = document.getElementById('edit-modal');
    if (modal) modal.style.display = 'none';
}

function toggleEditFields() {
    const type = (document.getElementById('edit-type') as HTMLSelectElement).value;
    const amountGroup = document.getElementById('edit-amount-group')!;
    const breastGroup = document.getElementById('edit-breast-group')!;

    if (type === 'milk' || type === 'pump') {
        amountGroup.style.display = 'block';
        breastGroup.style.display = 'none';
    } else if (type === 'breast') {
        amountGroup.style.display = 'none';
        breastGroup.style.display = 'block';
    } else {
        amountGroup.style.display = 'none';
        breastGroup.style.display = 'none';
    }
}

async function saveEdit() {
    const originalTimestamp = (document.getElementById('edit-original-timestamp') as HTMLInputElement).value;
    const timeVal = (document.getElementById('edit-time') as HTMLInputElement).value;
    const type = (document.getElementById('edit-type') as HTMLSelectElement).value;
    
    if (!timeVal) {
        alert("Time is required");
        return;
    }

    const timestamp = new Date(timeVal).toISOString();
    const entry: LogEntry = { type, timestamp };

    if (type === 'milk' || type === 'pump') {
        const amt = parseFloat((document.getElementById('edit-amount') as HTMLInputElement).value);
        if (isNaN(amt) || amt <= 0) {
            alert("Valid amount required");
            return;
        }
        entry.amount = amt;
    } else if (type === 'breast') {
        const side = (document.getElementById('edit-side') as HTMLSelectElement).value;
        const dur = parseInt((document.getElementById('edit-duration') as HTMLInputElement).value);
        if (isNaN(dur) || dur <= 0) {
            alert("Valid duration required");
            return;
        }
        entry.side = side;
        entry.duration = dur;
    }

    try {
        const res = await fetch(`/api/log?timestamp=${encodeURIComponent(originalTimestamp)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(entry)
        });

        if (!res.ok) {
            const txt = await res.text();
            throw new Error(txt || "Failed to update");
        }

        alert("Entry updated");
        closeEditModal();
        loadLogs();
    } catch (err) {
        alert("Error updating: " + err);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', loadLogs);
(window as any).toggleSelectAll = toggleSelectAll;
(window as any).deleteSelected = deleteSelected;
(window as any).openEditModal = openEditModal;
(window as any).closeEditModal = closeEditModal;
(window as any).saveEdit = saveEdit;
(window as any).toggleEditFields = toggleEditFields;
(window as any).changePage = changePage;
(window as any).changePageSize = changePageSize;
