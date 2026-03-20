import { DEFAULT_IDENTITY } from './config.js';
import { publishToUnison, fetchUserLyrics } from './api.js';

// App State
let currentUser = null;
let selectedFileContent = null;
let selectedFileFormat = null;

// DOM Elements
const screens = {
    login: document.getElementById('login-screen'),
    app: document.getElementById('app-screen')
};

// ==========================================
// INITIALIZATION
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    // Check for saved login
    const saved = localStorage.getItem('unisonIdentity');
    if (saved) {
        try {
            currentUser = JSON.parse(saved);
            showApp();
        } catch (e) {
            localStorage.removeItem('unisonIdentity');
        }
    } else {
        screens.app.style.display = 'none';
    }

    attachEventListeners();
});

// ==========================================
// EVENT LISTENERS
// ==========================================
function attachEventListeners() {
    // Auth
    document.getElementById('btn-default-login').addEventListener('click', () => saveUser(DEFAULT_IDENTITY));
    document.getElementById('btn-logout').addEventListener('click', logout);
    
    // File uploads
    document.getElementById('btn-upload-identity').addEventListener('click', () => document.getElementById('identity-file').click());
    document.getElementById('identity-file').addEventListener('change', handleIdentityUpload);
    
    document.getElementById('btn-browse-lyrics').addEventListener('click', () => document.getElementById('lyrics-file').click());
    document.getElementById('lyrics-file').addEventListener('change', handleLyricsSelection);

    // Tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', (e) => switchTab(e.target.dataset.target));
    });

    // API Actions
    document.getElementById('btn-publish').addEventListener('click', publishLyrics);
    document.getElementById('btn-refresh').addEventListener('click', loadMyLyrics);
}

// ==========================================
// AUTHENTICATION
// ==========================================
function handleIdentityUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.privateKey || !data.keyId) throw new Error("Invalid Identity JSON");
            saveUser(data);
        } catch (err) {
            alert("Error loading identity: " + err.message);
        }
    };
    reader.readAsText(file);
}

function saveUser(data) {
    currentUser = data;
    localStorage.setItem('unisonIdentity', JSON.stringify(data));
    showApp();
}

function logout() {
    localStorage.removeItem('unisonIdentity');
    currentUser = null;
    screens.login.style.display = 'block';
    screens.app.addEventListener('transitionend', () => {
        screens.app.style.display = 'none';
    }, { once: true });
    screens.login.style.opacity = '1';
    screens.login.style.visibility = 'visible';
    screens.app.style.opacity = '0';
    screens.app.style.visibility = 'hidden';
}

// ==========================================
// UI LOGIC
// ==========================================
function showApp() {
    screens.app.style.display = 'block';
    screens.login.addEventListener('transitionend', () => {
        screens.login.style.display = 'none';
    }, { once: true });
    screens.app.style.opacity = '1';
    screens.app.style.visibility = 'visible';
    screens.login.style.opacity = '0';
    screens.login.style.visibility = 'hidden';
    document.getElementById('display-name').innerText = currentUser.displayName || 'Unknown';
}

function switchTab(targetName) {
    // Update Tab Buttons
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.tab[data-target="${targetName}"]`).classList.add('active');

    // Update Tab Content
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`tab-${targetName}`).classList.add('active');

    if (targetName === 'check') loadMyLyrics();
}

function parseDuration(val) {
    if (val.includes(':')) {
        const parts = val.split(':');
        return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    }
    return parseInt(val, 10);
}

function setStatus(message, type) {
    const el = document.getElementById('status-msg');
    el.className = `text-${type}`;
    el.innerText = message;
}

// ==========================================
// FILE HANDLING
// ==========================================
function handleLyricsSelection(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    document.getElementById('selected-file-name').innerText = file.name;
    
    const ext = file.name.split('.').pop().toLowerCase();
    selectedFileFormat = (ext === 'ttml' || ext === 'lrc') ? ext : 'lrc';

    const reader = new FileReader();
    reader.onload = (e) => {
        // Remove carriage returns (\r) and trim
        selectedFileContent = e.target.result.replace(/\r\n/g, '\n').trim();
    };
    reader.readAsText(file);
}

// ==========================================
// APP LOGIC
// ==========================================
async function publishLyrics() {
    const vid = document.getElementById('vid').value.trim();
    const song = document.getElementById('song').value.trim();
    const artist = document.getElementById('artist').value.trim();
    const durStr = document.getElementById('dur').value.trim();
    const album = document.getElementById('album').value.trim();

    if (!vid || !song || !artist || !durStr) {
        return setStatus("Please fill in all required fields.", "warning");
    }

    if (!selectedFileContent) {
        return setStatus("Please select a lyrics file.", "warning");
    }

    const duration = parseDuration(durStr);
    if (isNaN(duration)) {
        return setStatus("Invalid duration format.", "error");
    }

    setStatus("Signing and Publishing...", "warning");

    try {
        const payload = {
            videoId: vid,
            song: song,
            artist: artist,
            duration: duration,
            lyrics: selectedFileContent,
            format: selectedFileFormat,
            language: "en",
            syncType: selectedFileFormat === "ttml" ? "richsync" : "linesync",
            keyId: currentUser.keyId,
            timestamp: Date.now(),
            nonce: crypto.randomUUID()
        };

        if (album) payload.album = album;

        await publishToUnison(payload, currentUser);
        
        setStatus("Successfully published! ✅", "success");
        document.getElementById('vid').value = ''; // clear only ID to allow fast multi-uploads of same album
    } catch (error) {
        setStatus(error.message, "error");
        console.error(error);
    }
}

async function loadMyLyrics() {
    const tbody = document.querySelector('#lyrics-table tbody');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Loading...</td></tr>';

    try {
        const json = await fetchUserLyrics(currentUser.keyId);
        const data = json.data || [];

        tbody.innerHTML = '';
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No lyrics found.</td></tr>';
            return;
        }

        data.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.song || 'Unknown'}</td>
                <td>${item.artist || 'Unknown'}</td>
                <td><span style="background:#333;padding:2px 6px;border-radius:4px;font-size:12px;">${(item.format || 'lrc').toUpperCase()}</span></td>
                <td>${item.score || 0}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-error" style="text-align:center;">${error.message}</td></tr>`;
    }
}