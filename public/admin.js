"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
let currentPage = 1;
let pageSize = 50;
let totalLogs = 0;
function loadLogs() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const res = yield fetch(`/api/log?page=${currentPage}&limit=${pageSize}`);
            if (!res.ok)
                throw new Error("Failed to load logs");
            const data = yield res.json();
            totalLogs = data.total || 0;
            const logs = data.logs || [];
            renderAdminTable(logs);
            updatePaginationControls();
        }
        catch (err) {
            console.error(err);
            alert("Failed to load logs.");
        }
    });
}
function updatePaginationControls() {
    const totalPages = Math.ceil(totalLogs / pageSize);
    const pageInfo = document.getElementById('page-info');
    const totalInfo = document.getElementById('total-info');
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    if (pageInfo)
        pageInfo.innerText = `Page ${currentPage} of ${totalPages || 1}`;
    if (totalInfo)
        totalInfo.innerText = `(${totalLogs} total)`;
    if (btnPrev)
        btnPrev.disabled = currentPage <= 1;
    if (btnNext)
        btnNext.disabled = currentPage >= totalPages;
}
function changePage(delta) {
    currentPage += delta;
    loadLogs();
}
function changePageSize() {
    const select = document.getElementById('page-size');
    pageSize = parseInt(select.value);
    currentPage = 1;
    loadLogs();
}
function renderAdminTable(logs) {
    const tbody = document.getElementById('log-table-body');
    if (!tbody)
        return;
    tbody.innerHTML = '';
    logs.forEach((log) => {
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
            <td><button class="btn-edit">Edit</button></td>
        `;
        const editBtn = tr.querySelector('.btn-edit');
        editBtn.onclick = () => openEditModal(log);
        tbody.appendChild(tr);
    });
}
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
            const res = yield fetch('/api/log', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(timestamps)
            });
            if (!res.ok)
                throw new Error("Failed to delete");
            const result = yield res.json();
            alert(`Deleted ${result.count || timestamps.length} entries.`);
            loadLogs();
        }
        catch (err) {
            console.error(err);
            alert("Error deleting logs: " + err);
        }
    });
}
function toggleSelectAll(source) {
    const checkboxes = document.querySelectorAll('.log-checkbox');
    checkboxes.forEach(cb => cb.checked = source.checked);
}
function openEditModal(log) {
    const modal = document.getElementById('edit-modal');
    if (!modal)
        return;
    document.getElementById('edit-original-timestamp').value = log.timestamp;
    const date = new Date(log.timestamp);
    const offset = date.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(date.getTime() - offset)).toISOString().slice(0, 16);
    document.getElementById('edit-time').value = localISOTime;
    const typeSelect = document.getElementById('edit-type');
    typeSelect.value = log.type;
    document.getElementById('edit-amount').value = log.amount ? log.amount.toString() : '';
    document.getElementById('edit-side').value = log.side || 'L';
    document.getElementById('edit-duration').value = log.duration ? log.duration.toString() : '';
    toggleEditFields();
    modal.style.display = 'flex';
}
function closeEditModal() {
    const modal = document.getElementById('edit-modal');
    if (modal)
        modal.style.display = 'none';
}
function toggleEditFields() {
    const type = document.getElementById('edit-type').value;
    const amountGroup = document.getElementById('edit-amount-group');
    const breastGroup = document.getElementById('edit-breast-group');
    if (type === 'milk' || type === 'pump') {
        amountGroup.style.display = 'block';
        breastGroup.style.display = 'none';
    }
    else if (type === 'breast') {
        amountGroup.style.display = 'none';
        breastGroup.style.display = 'block';
    }
    else {
        amountGroup.style.display = 'none';
        breastGroup.style.display = 'none';
    }
}
function saveEdit() {
    return __awaiter(this, void 0, void 0, function* () {
        const originalTimestamp = document.getElementById('edit-original-timestamp').value;
        const timeVal = document.getElementById('edit-time').value;
        const type = document.getElementById('edit-type').value;
        if (!timeVal) {
            alert("Time is required");
            return;
        }
        const timestamp = new Date(timeVal).toISOString();
        const entry = { type, timestamp };
        if (type === 'milk' || type === 'pump') {
            const amt = parseFloat(document.getElementById('edit-amount').value);
            if (isNaN(amt) || amt <= 0) {
                alert("Valid amount required");
                return;
            }
            entry.amount = amt;
        }
        else if (type === 'breast') {
            const side = document.getElementById('edit-side').value;
            const dur = parseInt(document.getElementById('edit-duration').value);
            if (isNaN(dur) || dur <= 0) {
                alert("Valid duration required");
                return;
            }
            entry.side = side;
            entry.duration = dur;
        }
        try {
            const res = yield fetch(`/api/log?timestamp=${encodeURIComponent(originalTimestamp)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(entry)
            });
            if (!res.ok) {
                const txt = yield res.text();
                throw new Error(txt || "Failed to update");
            }
            alert("Entry updated");
            closeEditModal();
            loadLogs();
        }
        catch (err) {
            alert("Error updating: " + err);
        }
    });
}
document.addEventListener('DOMContentLoaded', loadLogs);
window.toggleSelectAll = toggleSelectAll;
window.deleteSelected = deleteSelected;
window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;
window.saveEdit = saveEdit;
window.toggleEditFields = toggleEditFields;
window.changePage = changePage;
window.changePageSize = changePageSize;
