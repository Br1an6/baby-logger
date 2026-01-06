// State
let currentMilkAmount: number = 0;

// Update UI
function updateMilkDisplay() {
    const el = document.getElementById('milk-amount');
    if (el) el.innerText = currentMilkAmount.toString();
}

// Add Milk
function addMilk(amount: number) {
    currentMilkAmount += amount;
    updateMilkDisplay();
}

// Reset Milk
function resetMilk() {
    currentMilkAmount = 0;
    updateMilkDisplay();
}

// Submit Milk
async function submitMilk(btn?: HTMLElement) {
    if (currentMilkAmount <= 0) {
        alert("Please add milk amount first.");
        return;
    }
    
    await sendLog('milk', currentMilkAmount, btn);
    resetMilk();
}

// Record generic event
async function recordEvent(type: 'wet' | 'bm', btn?: HTMLElement) {
    await sendLog(type, undefined, btn);
}

// API Call
async function sendLog(type: string, amount?: number, btn?: HTMLElement) {
    try {
        const payload: any = { type };
        if (amount !== undefined) payload.amount = amount;

        const res = await fetch('/api/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
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
async function loadStats(duration: string) {
    try {
        const res = await fetch(`/api/stats?duration=${duration}`);
        if (!res.ok) throw new Error("Failed to load stats");
        
        const data = await res.json();
        renderStats(data);
    } catch (err) {
        console.error(err);
        alert("Failed to load stats");
    }
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
        
        // Refresh stats if visible, otherwise just alert
        const container = document.getElementById('stats-container');
        if (container && container.style.display !== 'none') {
             // Reload current view if possible, defaulting to '24h' for simplicity or tracking state
             // For now, let's just reload 24h as a safe default refresh
             await loadStats('24h');
        } else {
            alert("Last entry deleted.");
        }
    } catch (err) {
        alert("Error deleting: " + err);
    }
}

function renderStats(data: any) {
    const container = document.getElementById('stats-container');
    if (container) container.style.display = 'block';

    const totalMilk = document.getElementById('total-milk');
    if (totalMilk) totalMilk.innerText = (data.total_milk || 0).toFixed(1);

    const countWet = document.getElementById('count-wet');
    if (countWet) countWet.innerText = (data.diaper_wet || 0).toString();

    const countBM = document.getElementById('count-bm');
    if (countBM) countBM.innerText = (data.diaper_bm || 0).toString();

    const list = document.getElementById('log-list');
    if (list) {
        list.innerHTML = '';
        const logs = data.logs || [];
        // Sort newest first
        logs.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        logs.forEach((log: any) => {
            const li = document.createElement('li');
            li.className = 'log-item';
            
            const timeStr = new Date(log.timestamp).toLocaleString();
            let desc = "";
            let icon = "";
            
            if (log.type === 'milk') {
                icon = "🍼";
                desc = `Milk (${log.amount} oz)`;
            } else if (log.type === 'wet') {
                icon = "💧";
                desc = "Wet Diaper";
            } else if (log.type === 'bm') {
                icon = "💩";
                desc = "BM Diaper";
            }

            li.innerHTML = `<span>${icon} ${desc}</span> <span class="log-time">${timeStr}</span>`;
            list.appendChild(li);
        });
    }
}

// Expose functions to the global window object
(window as any).addMilk = addMilk;
(window as any).resetMilk = resetMilk;
(window as any).submitMilk = submitMilk;
(window as any).recordEvent = recordEvent;
(window as any).loadStats = loadStats;
(window as any).undoLast = undoLast;
