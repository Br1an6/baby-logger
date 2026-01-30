// State
let currentMilkAmount: number = 0;
let currentPumpAmount: number = 0;
let currentStatsDuration = 'today';
let currentStatsPage = 1;
let currentStatsLimit = 50;
let isStatsLoading = false;

// Log Entry Interface
interface LogEntry {
    type: string;
    amount?: number;
    side?: string;
    duration?: number;
    timestamp?: string; // ISO string
}

// Update UI
function updateMilkDisplay() {
    const el = document.getElementById('milk-amount');
    if (el) el.innerText = currentMilkAmount.toString();
}

function updatePumpDisplay() {
    const el = document.getElementById('pump-amount');
    if (el) el.innerText = currentPumpAmount.toString();
}

// Add Milk
function addMilk(amount: number) {
    currentMilkAmount += amount;
    updateMilkDisplay();
}

// Add Pump
function addPump(amount: number) {
    currentPumpAmount += amount;
    updatePumpDisplay();
}

// Reset Milk
function resetMilk() {
    currentMilkAmount = 0;
    updateMilkDisplay();
}

// Reset Pump
function resetPump() {
    currentPumpAmount = 0;
    updatePumpDisplay();
}

// Submit Milk
async function submitMilk(btn?: HTMLElement) {
    if (currentMilkAmount <= 0) {
        alert("Please add milk amount first.");
        return;
    }
    
    await sendLog({ type: 'milk', amount: currentMilkAmount }, btn);
    resetMilk();
}

// Submit Pump
async function submitPump(btn?: HTMLElement) {
    if (currentPumpAmount <= 0) {
        alert("Please add pump amount first.");
        return;
    }
    
    await sendLog({ type: 'pump', amount: currentPumpAmount }, btn);
    resetPump();
}

// Submit Breast Feed
async function submitBreastFeed(side: string, durationStr: string, btn?: HTMLElement) {
    const duration = parseInt(durationStr);
    if (isNaN(duration) || duration <= 0) {
        alert("Please enter a valid duration in minutes.");
        return;
    }

    await sendLog({ type: 'breast', side: side, duration: duration }, btn);
}

// Toggle Manual Amount Field
function toggleManualAmount() {
    const typeInput = document.getElementById('manual-type') as HTMLSelectElement;
    const amountGroup = document.getElementById('manual-amount-group') as HTMLElement;
    const amountLabel = document.getElementById('manual-amount-label') as HTMLElement;
    const type = typeInput.value;

    if (type === 'wet' || type === 'bm' || type === 'wet+bm') {
        amountGroup.style.display = 'none';
    } else {
        amountGroup.style.display = 'block';
        if (type === 'milk' || type === 'pump') {
            amountLabel.innerText = 'Amount (oz)';
        } else {
            amountLabel.innerText = 'Duration (min)';
        }
    }
}

// Submit Manual Entry
async function submitManualEntry() {
    const timeInput = document.getElementById('manual-time') as HTMLInputElement;
    const typeInput = document.getElementById('manual-type') as HTMLSelectElement;
    const amountInput = document.getElementById('manual-amount') as HTMLInputElement;

    if (!timeInput.value) {
        alert("Please select a time.");
        return;
    }

    const timestamp = new Date(timeInput.value).toISOString();
    const type = typeInput.value;
    const val = parseFloat(amountInput.value);

    const entry: LogEntry = { type, timestamp };

    if (type === 'milk' || type === 'pump') {
        if (isNaN(val) || val <= 0) {
             alert("Please enter a valid amount (oz).");
             return;
        }
        entry.amount = val;
    } else if (type === 'breast_left') {
        entry.type = 'breast';
        entry.side = 'L';
        if (isNaN(val) || val <= 0) {
            alert("Please enter a valid duration (min).");
            return;
        }
        entry.duration = Math.round(val);
    } else if (type === 'breast_right') {
        entry.type = 'breast';
        entry.side = 'R';
         if (isNaN(val) || val <= 0) {
            alert("Please enter a valid duration (min).");
            return;
        }
        entry.duration = Math.round(val);
    } else if (type === 'wet' || type === 'bm' || type === 'wet+bm') {
        // No extra fields needed
    }

    await sendLog(entry);
    alert("Manual entry saved.");
}

// Record generic event
async function recordEvent(type: 'wet' | 'bm' | 'wet+bm', btn?: HTMLElement) {
    await sendLog({ type }, btn);
}

// API Call
async function sendLog(entry: LogEntry, btn?: HTMLElement) {
    try {
        const res = await fetch('/api/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(entry)
        });

        if (!res.ok) throw new Error('Failed to save');
        
        // Visual feedback
        const target = btn || (document.activeElement as HTMLElement);
        if(target && target.tagName !== 'BODY' && target.tagName !== 'HTML') {
             const originalText = target.innerText;
             target.innerText = "Saved!";
             setTimeout(() => target.innerText = originalText, 1000);
        }
    } catch (err) {
        alert("Error saving log: " + err);
    }
}

// Load Stats
async function loadStats(duration: string, reset: boolean = true) {
    if (reset) {
        currentStatsDuration = duration;
        currentStatsPage = 1;
        
        // Clear list if resetting
        const list = document.getElementById('log-list');
        if (list) list.innerHTML = '';
        
        // Hide Load More initially
        const loadMoreBtn = document.getElementById('btn-load-more');
        if(loadMoreBtn) loadMoreBtn.style.display = 'none';

        // Highlight active button
        document.querySelectorAll('.btn-stats').forEach(b => b.classList.remove('active'));
        const btns = document.querySelectorAll('.btn-stats');
        btns.forEach(b => {
            if (b.getAttribute('onclick')?.includes(`'${duration}'`)) {
                b.classList.add('active');
            }
        });
    }

    if (isStatsLoading) return;
    isStatsLoading = true;

    try {
        const res = await fetch(`/api/stats?duration=${duration}&page=${currentStatsPage}&limit=${currentStatsLimit}`);
        if (!res.ok) throw new Error("Failed to load stats");
        
        const data = await res.json();
        
        // Update totals regardless of page (since server returns totals for ALL matching logs)
        renderStatsTotals(data);
        
        // Append logs
        renderStatsLogs(data.logs || []);

        // Manage Load More Button
        const loadMoreBtn = document.getElementById('btn-load-more');
        if (loadMoreBtn) {
            if ((data.logs || []).length < currentStatsLimit) {
                // End of list
                loadMoreBtn.style.display = 'none';
            } else {
                loadMoreBtn.style.display = 'block';
            }
        }

    } catch (err) {
        console.error(err);
        alert("Failed to load stats");
    } finally {
        isStatsLoading = false;
    }
}

function loadMoreStats() {
    currentStatsPage++;
    loadStats(currentStatsDuration, false);
}

function renderStatsTotals(data: any) {
    const container = document.getElementById('stats-container');
    if (container) container.style.display = 'block';

    const totalMilk = document.getElementById('total-milk');
    if (totalMilk) totalMilk.innerText = (data.total_milk || 0).toFixed(1);

    const totalPumped = document.getElementById('total-pumped');
    if (totalPumped) totalPumped.innerText = (data.total_pumped || 0).toFixed(1);

    const totalBreast = document.getElementById('total-breast');
    if (totalBreast) totalBreast.innerText = (data.total_breast_time || 0).toString();

    const countWet = document.getElementById('count-wet');
    if (countWet) countWet.innerText = (data.diaper_wet || 0).toString();

    const countBM = document.getElementById('count-bm');
    if (countBM) countBM.innerText = (data.diaper_bm || 0).toString();
}

function renderStatsLogs(logs: any[]) {
    const list = document.getElementById('log-list');
    if (!list) return;

    // Sort logs by timestamp DESC (newest first)
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    // We append, not clear, because of pagination
    
    logs.forEach((log: any) => {
        const li = document.createElement('li');
        li.className = 'log-item';
        
        const timeStr = new Date(log.timestamp).toLocaleString();
        let desc = "";
        let icon = "";
        
        if (log.type === 'milk') {
            icon = "🍼";
            desc = `Milk (${log.amount} oz)`;
        } else if (log.type === 'pump') {
            icon = "🧴";
            desc = `Pump (${log.amount} oz)`;
        } else if (log.type === 'wet') {
            icon = "💧";
            desc = "Wet Diaper";
        } else if (log.type === 'bm') {
            icon = "💩";
            desc = "BM Diaper";
        } else if (log.type === 'wet+bm') {
            icon = "💧💩";
            desc = "Wet & BM Diaper";
        } else if (log.type === 'breast') {
            icon = "🤱";
            desc = `Breast (${log.side}) - ${log.duration} min`;
        }

        li.innerHTML = `<span>${icon} ${desc}</span> <span class="log-time">${timeStr}</span>`;
        list.appendChild(li);
    });
}

// Undo Last Entry
async function undoLast() {
    if (!confirm("Are you sure you want to delete the last entry?")) return;

    try {
        const res = await fetch('/api/log/last', { method: 'DELETE' });
        if (!res.ok) {
            const txt = await res.text();
            throw new Error(txt || "Failed to delete");
        }
        
        // Refresh current stats
        await loadStats(currentStatsDuration, true);

    } catch (err) {
        alert("Error deleting: " + err);
    }
}

// Expose functions to the global window object
(window as any).addMilk = addMilk;
(window as any).resetMilk = resetMilk;
(window as any).submitMilk = submitMilk;
(window as any).addPump = addPump;
(window as any).resetPump = resetPump;
(window as any).submitPump = submitPump;
(window as any).submitBreastFeed = submitBreastFeed;
(window as any).submitManualEntry = submitManualEntry;
(window as any).recordEvent = recordEvent;
(window as any).loadStats = loadStats;
(window as any).loadMoreStats = loadMoreStats;
(window as any).undoLast = undoLast;
(window as any).toggleManualAmount = toggleManualAmount;

// Dark Mode
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode') ? 'true' : 'false');
}

function initDarkMode() {
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode === 'true') {
        document.body.classList.add('dark-mode');
    } else if (savedMode === null) {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.body.classList.add('dark-mode');
        }
    }
}

// Initialize
initDarkMode();
(window as any).toggleDarkMode = toggleDarkMode;