const API_BASE_URL = "https://unison.boidu.dev/lyrics"; 
const DEFAULT_IDENTITY = {
    "version": 1,
    "keyId": "cea10b57de8e060ed1a180a00c2bc717a2ab4f231d88fd33ffa6a50a04f23b6e",
    "publicKey": {
        "crv": "P-256", "ext": true, "key_ops": ["verify"], "kty": "EC",
        "x": "FyXkTGfDo1ySYc8VOoSoXLxJ7b1shp9nPv4NDwPDvy4",
        "y": "9DrxMD9jEhSo1tqOZf1k8x6DinRC9V2T4yB3FkwOGjI"
    },
    "privateKey": {
        "crv": "P-256", "d": "zzKTmI4DoeL_Mlib0QEpLLJe3RdzIR3gNbrmL1ffTkM", "ext": true, "key_ops":["sign"], "kty": "EC",
        "x": "FyXkTGfDo1ySYc8VOoSoXLxJ7b1shp9nPv4NDwPDvy4",
        "y": "9DrxMD9jEhSo1tqOZf1k8x6DinRC9V2T4yB3FkwOGjI"
    },
    "displayName": "MysticSnareRise"
};

// --- Crypto & Signatures ---
function canonicalJson(obj) {
    if (obj === null || obj === undefined) return 'null';
    if (typeof obj === 'boolean') return obj ? 'true' : 'false';
    if (typeof obj === 'number') return obj.toString();
    if (typeof obj === 'string') return JSON.stringify(obj);
    if (Array.isArray(obj)) return '[' + obj.map(canonicalJson).join(',') + ']';
    if (typeof obj === 'object') {
        const keys = Object.keys(obj).filter(k => obj[k] !== null && obj[k] !== undefined).sort();
        return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalJson(obj[k])).join(',') + '}';
    }
}

function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return window.btoa(binary);
}

async function signPayload(privateKeyJwk, payloadObj) {
    const key = await window.crypto.subtle.importKey("jwk", privateKeyJwk, { name: "ECDSA", namedCurve: "P-256" }, true,["sign"]);
    const data = new TextEncoder().encode(canonicalJson(payloadObj));
    const signatureBuffer = await window.crypto.subtle.sign({ name: "ECDSA", hash: { name: "SHA-256" } }, key, data);
    return arrayBufferToBase64(signatureBuffer);
}

// --- API Helpers ---
async function apiFetch(endpoint, options = {}) {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, options);
    const isJson = res.headers.get("content-type")?.includes("application/json");
    if (!res.ok) {
        const errorText = isJson ? (await res.json()).message || (await res.json()).error : await res.text();
        throw new Error(errorText || `Error ${res.status}`);
    }
    return isJson ? res.json() : res.text();
}

async function apiSignedAction(endpoint, payloadData) {
    const user = JSON.parse(localStorage.getItem('unisonIdentity'));
    if (!user) throw new Error("Not logged in");

    const payload = {
        ...payloadData,
        keyId: user.keyId,
        timestamp: Date.now(),
        nonce: crypto.randomUUID()
    };

    const signature = await signPayload(user.privateKey, payload);
    const envelope = { payload, signature, publicKey: user.publicKey };

    return apiFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-key-id": user.keyId },
        body: JSON.stringify(envelope)
    });
}

// --- Dynamic Time/Greeting Updates ---
function updateGreetingTime() {
    const greetingEl = document.getElementById('greeting-text');
    const timeEl = document.getElementById('time-text');
    if (!greetingEl || !timeEl) return;
    
    const user = JSON.parse(localStorage.getItem('unisonIdentity'));
    const name = user?.displayName || 'User'; 
    
    const now = new Date();
    const hours = now.getHours();
    let greeting = 'Good Evening';
    if (hours < 12) greeting = 'Good Morning';
    else if (hours < 18) greeting = 'Good Afternoon';
    
    greetingEl.innerText = `${greeting}, ${name}`;
    timeEl.innerText = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' · ' + now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

// --- App Initialization & Auth Guard ---
document.addEventListener("DOMContentLoaded", () => {
    // Apply Theme
    const theme = localStorage.getItem('unisonTheme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);

    const isLoginPage = window.location.pathname.includes('login.html');
    const user = JSON.parse(localStorage.getItem('unisonIdentity'));

    // Auth Redirects
    if (!user && !isLoginPage) {
        window.location.href = 'login.html';
        return;
    }
    if (user && isLoginPage) {
        window.location.href = 'index.html';
        return;
    }

    // Nav Active States
    const pageId = document.body.id;
    const navSearch = document.getElementById('nav-search');
    const navSubmissions = document.getElementById('nav-submissions');
    if (pageId === 'page-search' && navSearch) navSearch.classList.add('active');
    if (pageId === 'page-submissions' && navSubmissions) navSubmissions.classList.add('active');

    // Global Search Binding
    const searchInput = document.getElementById('global-search');
    if (searchInput) {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('q')) searchInput.value = urlParams.get('q');

        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const q = e.target.value.trim();
                window.location.href = q ? `index.html?q=${encodeURIComponent(q)}` : 'index.html';
            }
        });
    }

    // Route Initializers
    if (pageId === 'page-search') {
        initSearchPage();
        setInterval(updateGreetingTime, 1000);
        updateGreetingTime();
    }
    if (pageId === 'page-submissions') initSubmissionsPage();
    if (pageId === 'page-submit') initSubmitPage();
    if (pageId === 'page-detail') initDetailPage();
    if (pageId === 'page-account') initAccountPage();
});

// --- Login Handlers ---
function loginDefault() {
    localStorage.setItem('unisonIdentity', JSON.stringify(DEFAULT_IDENTITY));
    window.location.href = 'index.html';
}

function handleIdentityUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.privateKey || !data.keyId) throw new Error("Invalid Identity JSON");
            localStorage.setItem('unisonIdentity', JSON.stringify(data));
            window.location.href = 'index.html';
        } catch (err) { alert("Error loading identity: " + err.message); }
    };
    reader.readAsText(file);
}

function logout() {
    localStorage.removeItem('unisonIdentity');
    window.location.href = 'login.html';
}

// --- Pages Logic ---

/* 1. Search / Home Page */
async function initSearchPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q');
    
    const defaultView = document.getElementById('home-default-view');
    const searchView = document.getElementById('search-results-view');
    const resultsDiv = document.getElementById('search-results');
    const headerTitle = document.getElementById('search-header');

    if (!query) {
        defaultView.style.display = 'block';
        searchView.style.display = 'none';
        return;
    }

    defaultView.style.display = 'none';
    searchView.style.display = 'block';

    headerTitle.innerText = `Search Results for "${query}"`;
    resultsDiv.innerHTML = `<div class="empty-state text-secondary animate-fade-up"><span class="material-symbols-rounded spinner" style="vertical-align: middle; margin-right:8px;">sync</span> Searching...</div>`;

    try {
        const res = await apiFetch(`/search?q=${encodeURIComponent(query)}`);
        const items = res.data ||[];
        
        if (!items.length) {
            resultsDiv.innerHTML = `<div class="empty-state text-secondary animate-fade-up">No lyrics found for "${query}".</div>`;
            return;
        }

        resultsDiv.innerHTML = items.map(item => `
            <div class="card animate-fade-up" onclick="window.location.href='detail.html?id=${item.id || item.videoId}'">
                <div>
                    <div class="card-title">${item.song || 'Unknown Song'}</div>
                    <div class="card-artist">${item.artist || 'Unknown Artist'}</div>
                    <div class="card-badges">
                        <span class="badge">${(item.format || 'LRC').toUpperCase()}</span>
                        ${item.syncType ? `<span class="badge">${item.syncType.toUpperCase()}</span>` : ''}
                        ${item.confidence ? `<span class="badge ${item.confidence === 'low' ? 'low' : 'high'}">${item.confidence.toUpperCase()} CONFIDENCE</span>` : ''}
                    </div>
                </div>
                <div class="card-footer">
                    <span>${item.voteCount >= 0 ? '+' : ''}${item.voteCount || 0} votes</span>
                    <span>Score: ${Number(item.score).toFixed(1)}</span>
                </div>
            </div>
        `).join('');
    } catch (err) {
        resultsDiv.innerHTML = `<div class="empty-state text-secondary animate-fade-up" style="color: var(--danger)">Search failed: ${err.message}</div>`;
    }
}

/* 2. My Submissions Page */
async function initSubmissionsPage() {
    const resultsDiv = document.getElementById('search-results');
    resultsDiv.innerHTML = `<div class="empty-state text-secondary animate-fade-up"><span class="material-symbols-rounded spinner" style="vertical-align: middle; margin-right:8px;">sync</span> Loading your submissions...</div>`;

    try {
        const user = JSON.parse(localStorage.getItem('unisonIdentity'));
        const res = await apiFetch(`/mine?limit=50`, {
            headers: { "x-key-id": user.keyId }
        });
        const items = res.data ||[];
        
        if (!items.length) {
            resultsDiv.innerHTML = `<div class="empty-state text-secondary animate-fade-up">You haven't submitted any lyrics yet.</div>`;
            return;
        }

        resultsDiv.innerHTML = items.map(item => `
            <div class="card animate-fade-up" onclick="window.location.href='detail.html?id=${item.id || item.videoId}'">
                <div>
                    <div class="card-title">${item.song || 'Unknown Song'}</div>
                    <div class="card-artist">${item.artist || 'Unknown Artist'}</div>
                    <div class="card-badges">
                        <span class="badge">${(item.format || 'LRC').toUpperCase()}</span>
                        ${item.syncType ? `<span class="badge">${item.syncType.toUpperCase()}</span>` : ''}
                    </div>
                </div>
                <div class="card-footer">
                    <span>${item.voteCount >= 0 ? '+' : ''}${item.voteCount || 0} votes</span>
                    <span>Score: ${Number(item.score).toFixed(1)}</span>
                </div>
            </div>
        `).join('');
    } catch (err) {
        resultsDiv.innerHTML = `<div class="empty-state text-secondary animate-fade-up" style="color: var(--danger)">
  Failed to load submissions: ${err.message}<br>
  Make sure you have uploaded at least one lyric.
</div>`;
    }
}

function handleLyricsFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        // Drop the file contents into the textarea
        document.getElementById('sub-lyrics').value = e.target.result;
        
        // Auto-detect format based on file extension
        const ext = file.name.split('.').pop().toLowerCase();
        const formatSelect = document.getElementById('sub-format');
        if (ext === 'ttml') formatSelect.value = 'ttml';
        else if (ext === 'lrc' || ext === 'elrc') formatSelect.value = 'lrc';
        
        // Update the live preview
        updateSubmitPreview();
    };
    reader.readAsText(file);
    
    // Clear the input so the same file can be uploaded again if needed
    event.target.value = ''; 
}

async function initDetailPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    if (!id) { window.location.href = 'index.html'; return; }

    try {
        const res = await apiFetch(`/${id}`);
        const item = res.data;
        window.currentLyricData = item; // Store for download

        document.getElementById('det-title').innerText = item.song || 'Unknown';
        document.getElementById('det-artist').innerText = item.artist || 'Unknown';
        document.getElementById('det-format').innerText = (item.format || 'unknown').toUpperCase();
        document.getElementById('det-sync').innerText = item.syncType || 'none';
        document.getElementById('det-lang').innerText = (item.language || 'en').toUpperCase();
        document.getElementById('det-score').innerText = Number(item.score).toFixed(1) || 0;
        document.getElementById('det-votecount').innerText = `${item.voteCount || 0} votes`;
        document.getElementById('det-raw').innerText = item.lyrics;

        let previewText = item.lyrics;
        if (item.format === 'ttml') {
            try {
                let xmlDoc = new DOMParser().parseFromString(item.lyrics, "text/xml");
                previewText = Array.from(xmlDoc.getElementsByTagName("p"))
                                   .map(p => p.textContent.trim().replace(/\s+/g, ' ')).join('\n');
            } catch(e) {}
        } else if (item.format === 'lrc') {
            previewText = item.lyrics.split('\n').map(l => l.replace(/\[.*?\]/g, '').replace(/<.*?>/g, '').trim()).filter(l=>l).join('\n');
        }
        document.getElementById('det-preview').innerText = previewText || "No preview available.";

        window.currentLyricId = id;
    } catch (err) {
        document.getElementById('det-title').innerText = "Error Loading Lyrics";
        document.getElementById('det-artist').innerText = err.message;
    }
}

function downloadLyrics() {
    if (!window.currentLyricData) return;
    const { lyrics, song, artist, format } = window.currentLyricData;
    const ext = format === 'ttml' ? 'ttml' : (format === 'lrc' ? 'lrc' : 'txt');
    const filename = `${artist || 'Unknown'} - ${song || 'Unknown'}.${ext}`.replace(/[\\/:*?"<>|]/g, '');
    const blob = new Blob([lyrics], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

async function submitVote(val) {
    try {
        await apiSignedAction(`/${window.currentLyricId}/vote`, { vote: val });
        alert("Vote submitted successfully!");
        location.reload();
    } catch (err) { alert("Vote failed: " + err.message); }
}

async function submitReport() {
    const reason = document.getElementById('report-reason').value;
    const details = document.getElementById('report-details').value;
    try {
        await apiSignedAction(`/${window.currentLyricId}/report`, { reason, details });
        alert("Report submitted.");
        document.getElementById('report-dialog').close();
    } catch (err) { alert("Report failed: " + err.message); }
}

/* 4. Account Page */
function initAccountPage() {
    const user = JSON.parse(localStorage.getItem('unisonIdentity'));
    document.getElementById('acc-name').innerText = user.displayName || 'Unknown User';
    
    const privateDetails = document.getElementById('private-details');
    if (user.keyId === DEFAULT_IDENTITY.keyId) {
        privateDetails.style.display = 'none';
    } else {
        privateDetails.style.display = 'block';
        let displayKey = user.keyId;
        if (displayKey.length > 50) displayKey = displayKey.substring(0, 50) + '...';
        document.getElementById('acc-key').innerText = displayKey;
        
        document.getElementById('copy-id-btn').onclick = () => {
            navigator.clipboard.writeText(user.keyId);
            alert("ID copied to clipboard!");
        };
        document.getElementById('export-btn').onclick = () => {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(user));
            const anchor = document.createElement('a');
            anchor.setAttribute("href", dataStr);
            anchor.setAttribute("download", "unison_identity.json");
            anchor.click();
        };
    }

    const themeBtn = document.getElementById('theme-toggle-btn');
    const currentTheme = localStorage.getItem('unisonTheme') || 'dark';
    themeBtn.innerHTML = currentTheme === 'dark' ? '<span class="material-symbols-rounded">light_mode</span> Switch to Light Mode' : '<span class="material-symbols-rounded">dark_mode</span> Switch to Dark Mode';

    themeBtn.addEventListener('click', () => {
        const newTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('unisonTheme', newTheme);
        themeBtn.innerHTML = newTheme === 'dark' ? '<span class="material-symbols-rounded">light_mode</span> Switch to Light Mode' : '<span class="material-symbols-rounded">dark_mode</span> Switch to Dark Mode';
    });
}

/* 5. Submit Page */
function initSubmitPage() {
    const inputArea = document.getElementById('sub-lyrics');
    inputArea.addEventListener('input', updateSubmitPreview);
}

function updateSubmitPreview() {
    const text = document.getElementById('sub-lyrics').value;
    const previewBox = document.getElementById('preview-box');
    
    if(!text.trim()) { previewBox.innerText = "Preview will appear here..."; return; }
    
    let format = document.getElementById('sub-format').value;
    let pText = text;

    if (format === 'auto' || format === 'ttml') {
        if (text.includes('<tt') && text.includes('</tt>')) {
            try {
                let xmlDoc = new DOMParser().parseFromString(text, "text/xml");
                pText = Array.from(xmlDoc.getElementsByTagName("p")).map(p => p.textContent.trim().replace(/\s+/g, ' ')).join('\n');
                if (format === 'auto') document.getElementById('sub-format').value = 'ttml';
            } catch(e){}
        }
    }
    if ((format === 'auto' || format === 'lrc') && text.includes('[')) {
        pText = text.split('\n').map(l => l.replace(/\[\d+:\d+\.\d+\]/g, '').replace(/<\d+:\d+\.\d+>/g, '').replace(/\[bg:.*?\]/g, '').trim()).filter(l=>l).join('\n');
        if(format === 'auto') document.getElementById('sub-format').value = 'lrc';
    }
    previewBox.innerText = pText;
}

function formatTimeTTML(timestamp) {
    if (!timestamp) return null;
    let ts = timestamp.replace(/[\[\]<>]/g, '').trim();
    let parts = ts.split(':');
    if(parts.length < 2) return null;
    let minutes = parseInt(parts[0], 10);
    let seconds = parseFloat(parts[1]);
    let hours = Math.floor(minutes / 60);
    minutes = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${seconds.toFixed(3).padStart(6, '0')}`;
}

function convertLyrics(target) {
    const area = document.getElementById('sub-lyrics');
    let txt = area.value;
    if(!txt.trim()) return alert("Paste ELRC lyrics first.");

    if (target === 'lrc') {
        area.value = txt.split('\n').map(line => line.replace(/<\d+:\d+\.\d+>/g, '').replace(/\[bg:(.*?)\]/g, '$1').replace(/\s+/g, ' ').trim()).filter(l => l).join('\n');
        document.getElementById('sub-format').value = 'lrc';
    } else if (target === 'ttml') {
        let xml = `<?xml version="1.0" encoding="utf-8"?>\n<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xml:lang="en">\n  <body>\n    <div>\n`;
        txt.split('\n').forEach(line => {
            let match = line.match(/^\[(\d+:\d+\.\d+)\](.*)/);
            if (!match) return;
            let lineContent = match[2];
            let allTs =[...line.matchAll(/(\d+:\d+\.\d+)/g)].map(m => m[1]);
            if (!allTs.length) return;
            
            let formattedTs = allTs.map(formatTimeTTML).sort();
            let pBegin = formattedTs[0];
            let pEnd = formattedTs[formattedTs.length - 1];
            if (pBegin === pEnd) {
                let [m, s] = match[1].split(':').map(Number);
                pEnd = formatTimeTTML(`${m}:${(s + 3.0).toFixed(3)}`);
            }

            xml += `      <p begin="${pBegin}" end="${pEnd}">\n`;
            const processSeg = (t, isBg) => {
                let parts = t.split(/<(\d+:\d+\.\d+)>/g);
                let res = isBg ? `        <span ttm:role="x-bg">\n` : "";
                for (let j = 1; j < parts.length; j += 2) {
                    if (parts[j+1]?.trim()) {
                        let wE = (j + 2 < parts.length) ? formatTimeTTML(parts[j+2]) : pEnd;
                        res += `          <span begin="${formatTimeTTML(parts[j])}" end="${wE}">${parts[j+1].trim().replace(/</g, "&lt;").replace(/>/g, "&gt;")} </span>\n`;
                    }
                }
                return res + (isBg ? `        </span>\n` : "");
            };
            xml += processSeg(lineContent.replace(/\[bg:(.*?)\]/g, '').trim(), false);[...lineContent.matchAll(/\[bg:(.*?)\]/g)].forEach(m => xml += processSeg(m[1].trim(), true));
            xml += `      </p>\n`;
        });
        xml += `    </div>\n  </body>\n</tt>`;
        area.value = xml;
        document.getElementById('sub-format').value = 'ttml';
    }
    updateSubmitPreview();
}

async function submitLyricsForm() {
    const vid = document.getElementById('sub-vid').value.trim();
    const song = document.getElementById('sub-song').value.trim();
    const artist = document.getElementById('sub-artist').value.trim();
    const durStr = document.getElementById('sub-duration').value.trim();
    const lyrics = document.getElementById('sub-lyrics').value.trim();
    const btn = document.getElementById('submit-btn');

    if(!vid || !song || !artist || !durStr || !lyrics) return alert("Please fill in all required fields.");

    let format = document.getElementById('sub-format').value;
    if(format === 'auto') format = lyrics.includes('<tt') ? 'ttml' : 'lrc';

    try {
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-rounded spinner">sync</span> Publishing...';

        const payload = {
            videoId: vid, song, artist, lyrics, format,
            duration: parseInt(durStr, 10),
            album: document.getElementById('sub-album').value.trim() || undefined,
            language: "en",
            syncType: format === 'ttml' ? 'richsync' : (format === 'lrc' ? 'linesync' : 'plain')
        };

        await apiSignedAction('/submit', payload);
        alert("Successfully published! ✅");
        window.location.href = 'index.html';
    } catch(e) {
        alert("Submission failed: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-rounded">publish</span> Submit to Unison';
    }
}

