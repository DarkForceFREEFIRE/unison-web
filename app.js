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

const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmb290cWxxem13YnBxdm9oaXF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNTgyMjYsImV4cCI6MjA5MDgzNDIyNn0.yYwJ_YWhlMHGDVTQvbwAfVEPO9cJVo5QIlrllGDobSI";
const FEEDBACK_API_URL = "https://rfootqlqzmwbpqvohiqu.supabase.co/functions/v1/submit-feedback";
const USERS_API_URL = "https://rfootqlqzmwbpqvohiqu.supabase.co/functions/v1/hyper-action";
const BETTER_LYRICS_LOGO = "https://better-lyrics.boidu.dev/icons/logo.svg";

let ytPlayer = null;
window.parsedLines = [];
window.currentActiveLineIndex = -1;
let hasWarnedELRC = false; 

function formatPlayerTime(seconds) {
    if (isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return; 
    const toast = document.createElement('div');
    
    let icon = 'info';
    if(type === 'success') icon = 'check_circle';
    if(type === 'error') icon = 'error';

    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span class="material-symbols-rounded" style="font-size: 24px;">${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('hide');
        toast.addEventListener('animationend', () => toast.remove());
    }, 4500);
}

window.alert = function(message) {
    if (typeof message !== 'string') message = String(message);
    const msgLower = message.toLowerCase();
    if (msgLower.includes('failed') || msgLower.includes('error') || msgLower.includes('please')) {
        showToast(message, 'error');
    } else {
        showToast(message, 'success');
    }
};
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

async function apiFetch(endpoint, options = {}) {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, options);
    const isJson = res.headers.get("content-type")?.includes("application/json");
    const json = await res.json()
    if (!res.ok) {
        const errorText = isJson ? json.message || json.error : await res.text();
        throw new Error(errorText || `Error ${res.status}`);
    }
    return isJson ? json : res.text();
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

document.addEventListener("DOMContentLoaded", () => {
    const theme = localStorage.getItem('unisonTheme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);

    const isLoginPage = window.location.pathname.includes('login.html');
    const user = JSON.parse(localStorage.getItem('unisonIdentity'));

    if (!user && !isLoginPage) { window.location.href = 'login.html'; return; }
    if (user && isLoginPage) { window.location.href = 'index.html'; return; }

    
    const searchInput = document.getElementById('global-search');
    if (searchInput) {
        
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('q')) {
            searchInput.value = urlParams.get('q');
        }

        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const query = searchInput.value.trim();
                if (query) {
                    window.location.href = `index.html?q=${encodeURIComponent(query)}`;
                } else {
                    window.location.href = `index.html`;
                }
            }
        });
    }

    const pageId = document.body.id;
    if (pageId === 'page-search') {
        initSearchPage();
        loadActiveUsers();
        setInterval(updateGreetingTime, 1000);
        updateGreetingTime();
    }
    if (pageId === 'page-submissions') initSubmissionsPage();
    if (pageId === 'page-submit') initSubmitPage();
    if (pageId === 'page-detail') initDetailPage();
    if (pageId === 'page-account') initAccountPage();
});

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


async function initSearchPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q');
    
    const defaultView = document.getElementById('home-default-view');
    const searchView = document.getElementById('search-results-view');
    const resultsDiv = document.getElementById('search-results');
    const headerTitle = document.getElementById('search-header');

    if (!defaultView || !searchView || !resultsDiv || !headerTitle) {
        console.error('Search page markup is missing required elements.');
        return;
    }

    if (!query) {
        defaultView.style.display = 'block';
        searchView.style.display = 'none';
        return;
    }

    defaultView.style.display = 'none';
    searchView.style.display = 'block';
    headerTitle.innerText = `Search Results for "${query}"`;
    resultsDiv.innerHTML = `<div class="empty-state text-secondary"><span class="material-symbols-rounded spinner" style="vertical-align: middle; margin-right:8px;">sync</span> Searching...</div>`;

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

async function initSubmissionsPage() {
    const user = JSON.parse(localStorage.getItem('unisonIdentity'));
    const urlParams = new URLSearchParams(window.location.search);
    const name = urlParams.get('name');
    const parsedName = name ? `${name}'${name.toLowerCase().endsWith('s') ? '' : 's'}` : "Their"
    const id = urlParams.get('id') || user.keyId;

    const same = id === user.keyId

    const header = document.getElementById('search-header');
    header.innerText = `${same ? 'My' : parsedName} Submissions`
    document.querySelector("title").innerText = `${same ? 'My' : parsedName} Submissions | Unison`

    const resultsDiv = document.getElementById('search-results');
    resultsDiv.innerHTML = `<div class="empty-state text-secondary"><span class="material-symbols-rounded spinner" style="vertical-align: middle; margin-right:8px;">sync</span> Loading ${same ? 'your' : 'their'} submissions...</div>`;

    try {
        const res = await apiFetch(`/mine?limit=50`, { headers: { "x-key-id": id } });
        const items = res.data ||[];
        
        if (!items.length) {
            resultsDiv.innerHTML = `<div class="empty-state text-secondary animate-fade-up">${same ? "You" : "They"} haven't submitted any lyrics yet.</div>`;
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
        resultsDiv.innerHTML = `<div class="empty-state text-secondary animate-fade-up" style="color: var(--danger)">Failed to load submissions: ${err.message}</div>`;
    }
}

async function initDetailPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    if (!id) { window.location.href = 'index.html'; return; }

    try {
        const res = await apiFetch(`/${id}`);
        const item = res.data;
        window.currentLyricData = item;
        window.currentLyricId = id;

        document.getElementById('det-title').innerText = item.song || 'Unknown';
        document.getElementById('det-artist').innerText = item.artist || 'Unknown';
        document.getElementById('det-format').innerText = (item.format || 'unknown').toUpperCase();
        document.getElementById('det-sync').innerText = item.syncType || 'none';
        document.getElementById('det-lang').innerText = (item.language || 'en').toUpperCase();
        document.getElementById('det-score').innerText = Number(item.score).toFixed(1) || 0;
        document.getElementById('det-votecount').innerText = `${item.voteCount || 0} votes`;
        document.getElementById('det-raw').innerText = item.lyrics;

        // Initialize player and interactive preview
        if (item.videoId && item.videoId !== 'local-file') {
            page.activeSource = 'yt';
            const placeholder = document.getElementById('media-placeholder');
            if(placeholder) placeholder.classList.add('hidden');
            
            if (page.isPlayerReady) {
                if(ytPlayer && typeof ytPlayer.loadVideoById === 'function') ytPlayer.loadVideoById(item.videoId);
            } else {
                page.videoIdToLoad = item.videoId;
            }
        } else {
            const placeholder = document.getElementById('media-placeholder');
            if(placeholder) {
                placeholder.classList.remove('hidden');
                placeholder.innerHTML = `<span class="material-symbols-rounded" style="font-size: 48px; margin-bottom: 8px;">music_off</span> Media not available for this entry.`;
            }
            const ytContainer = document.getElementById('yt-player-container');
            if(ytContainer) ytContainer.classList.add('hidden');
        }

        const isTTML = item.format === 'ttml';
        if (isTTML) window.parsedLines = parseTTML(item.lyrics);
        else window.parsedLines = parseEnhancedLRC(item.lyrics);
        
        renderPreview('det-preview');

    } catch (err) {
        document.getElementById('det-title').innerText = "Error Loading Lyrics";
        document.getElementById('det-artist').innerText = err.message;
    }
}

async function submitVote(voteValue) {
    if (!window.currentLyricId) return;
    try {
        await apiSignedAction(`/${window.currentLyricId}/vote`, { vote: voteValue });
        showToast("Your vote has been recorded!", "success");
        const res = await apiFetch(`/${window.currentLyricId}`);
        const item = res.data;
        document.getElementById('det-score').innerText = Number(item.score).toFixed(1) || 0;
        document.getElementById('det-votecount').innerText = `${item.voteCount || 0} votes`;
    } catch (err) {
        showToast(`Vote failed: ${err.message}`, "error");
    }
}

async function submitReport() {
    if (!window.currentLyricId) return;
    const dialog = document.getElementById('report-dialog');
    const reason = document.getElementById('report-reason').value;
    const details = document.getElementById('report-details').value;

    if (!reason) return showToast("Please select a reason.", "error");

    try {
        await apiSignedAction(`/${window.currentLyricId}/report`, { reason, details });
        showToast("Report submitted successfully. Thank you!", "success");
        dialog.close();
        document.getElementById('report-details').value = '';
    } catch (err) {
        showToast(`Report failed: ${err.message}`, "error");
    }
}

function downloadLyrics() {
    if (!window.currentLyricData) return;
    const { lyrics, song, artist, format } = window.currentLyricData;
    const ext = format === 'ttml' ? 'ttml' : (format === 'lrc' ? 'lrc' : 'txt');
    const filename = `${artist || 'Unknown'} - ${song || 'Unknown'}.${ext}`.replace(/[\\\\/:*?"<>|]/g, '');
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

function copyRawLyrics() {
    const rawText = document.getElementById('det-raw').innerText;
    if (!rawText) return showToast("Nothing to copy!", "error");
    navigator.clipboard.writeText(rawText).then(() => {
        showToast("Raw lyrics copied to clipboard!", "info");
    }).catch(err => { showToast("Failed to copy text", "error"); });
}

function initAccountPage() {
    const user = JSON.parse(localStorage.getItem('unisonIdentity'));
    document.getElementById('acc-name').innerText = user.displayName || 'Unknown User';
    
    const avatarPreview = document.getElementById('acc-avatar-preview');
    const savedAvatar = localStorage.getItem('unisonAvatar');
    
    if (user.keyId === DEFAULT_IDENTITY.keyId) {
        avatarPreview.src = BETTER_LYRICS_LOGO;
        
        document.getElementById('avatar-settings-block').style.display = 'none';
    } else {
        if (savedAvatar) {
            avatarPreview.src = savedAvatar;
        }
    }
    
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
            showToast("ID copied to clipboard!", "info");
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
    themeBtn.innerHTML = currentTheme === 'dark' 
        ? '<span class="material-symbols-rounded">light_mode</span> <span class="hide-mobile">Switch to Light Mode</span>' 
        : '<span class="material-symbols-rounded">dark_mode</span> <span class="hide-mobile">Switch to Dark Mode</span>';

    themeBtn.addEventListener('click', () => {
        const newTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('unisonTheme', newTheme);
        themeBtn.innerHTML = newTheme === 'dark' 
            ? '<span class="material-symbols-rounded">light_mode</span> <span class="hide-mobile">Switch to Light Mode</span>' 
            : '<span class="material-symbols-rounded">dark_mode</span> <span class="hide-mobile">Switch to Dark Mode</span>';
    });
}


const page = {
    player: null,
    isPlayerReady: false,
    videoIdToLoad: null,
    activeSource: 'yt',
    syncTimer: null,

    onPlayerReady(event) {
        ytPlayer = event.target;
        this.isPlayerReady = true;
        if (this.videoIdToLoad) {
            ytPlayer.loadVideoById(this.videoIdToLoad);
            this.videoIdToLoad = null;
        }
    },

    switchSource(src) {
        this.activeSource = src;
        document.getElementById('tab-yt').classList.toggle('active', src === 'yt');
        document.getElementById('tab-file').classList.toggle('active', src === 'file');
        document.getElementById('input-yt').classList.toggle('hidden', src !== 'yt');
        document.getElementById('input-file').classList.toggle('hidden', src !== 'file');
        
        document.getElementById('yt-player-container').classList.toggle('hidden', src !== 'yt');
        document.getElementById('custom-audio-player').classList.toggle('hidden', src !== 'file');
        document.getElementById('media-placeholder').classList.add('hidden');
        document.getElementById('media-error-overlay').classList.add('hidden');
        
        this.stopSyncLoop();
        if (src === 'file' && ytPlayer && ytPlayer.pauseVideo) ytPlayer.pauseVideo();
        if (src === 'yt') {
            const localPlayer = document.getElementById('local-player');
            if(localPlayer) localPlayer.pause();
        }
    },

    parseYoutubeUrl(url) {
    const regExp = /^.*((youtu\.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    const id = (match && match[7].length === 11) ? match[7] : null;

    if (id) {
        document.getElementById('sub-vid').value = id;
        document.getElementById('media-placeholder').classList.add('hidden');
        document.getElementById('media-error-overlay').classList.add('hidden');

        if (this.isPlayerReady) ytPlayer.loadVideoById(id);
        else this.videoIdToLoad = id;

        this.fetchYouTubeMetadata(id);
    }
    },

async fetchYouTubeMetadata(id) {
    try {
        const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`);
        if (!res.ok) return;
        const data = await res.json();
        
        let title = data.title || "";
        let author = data.author_name || ""; 

        const songInput = document.getElementById('sub-song');
        const artistInput = document.getElementById('sub-artist');

        if (title.includes(" - ")) {
            const parts = title.split(" - ");
            
            const extractedArtist = parts[0].trim();
            const extractedSong = parts[1].trim();

            if (!artistInput.value) artistInput.value = extractedArtist;
            if (!songInput.value) songInput.value = extractedSong;
        } else {
            if (!songInput.value) songInput.value = title;
            if (!artistInput.value) artistInput.value = author.replace(" - Topic", "").trim();
        }
        
        showToast("YouTube metadata extracted automatically!", "info");
    } catch (err) {
        console.error("Metadata extraction error:", err);
    }
},

    loadLocalFile(event) {
        const file = event.target.files[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        const audio = document.getElementById('local-player');
        audio.src = url;
        
        document.getElementById('media-placeholder').classList.add('hidden');
        
        if (window.jsmediatags) {
            jsmediatags.read(file, {
                onSuccess: function(tag) {
                    const tags = tag.tags;
                    const title = tags.title || file.name.split('.')[0];
                    const artist = tags.artist || "Unknown Artist";
                    
                    document.getElementById('player-title').innerText = title;
                    document.getElementById('player-artist').innerText = artist;
                    
                    if (!document.getElementById('sub-song').value) document.getElementById('sub-song').value = title;
                    if (!document.getElementById('sub-artist').value) document.getElementById('sub-artist').value = artist;

                    if (tags.picture) {
                        const data = tags.picture.data;
                        const format = tags.picture.format;
                        let base64String = "";
                        for (let i = 0; i < data.length; i++) base64String += String.fromCharCode(data[i]);
                        const imgUrl = `data:${format};base64,${window.btoa(base64String)}`;
                        
                        document.getElementById('player-cover').src = imgUrl;
                        document.getElementById('player-bg').style.backgroundImage = `url(${imgUrl})`;
                    } else {
                        page.setDefaultCover(title);
                    }
                },
                onError: function() { page.setDefaultCover(file.name.split('.')[0]); }
            });
        }
    },

    setDefaultCover(title) {
        document.getElementById('player-title').innerText = title || "Local Audio";
        document.getElementById('player-artist').innerText = "Unknown Artist";
        document.getElementById('player-cover').src = BETTER_LYRICS_LOGO;
        document.getElementById('player-bg').style.backgroundImage = 'none';
        document.getElementById('player-bg').style.backgroundColor = '#111';
    },

    handlePlayerError(event) {
        if ([2, 100, 101, 150].includes(event.data) && this.activeSource === 'yt') {
            document.getElementById('media-error-overlay').classList.remove('hidden');
        }
    },

    startSyncLoop() {
        this.stopSyncLoop();
        window.currentActiveLineIndex = -1; 
        
        let activeLineContainer = null;
        let activeWordElements = [];
        let lastTime = -1;

        const sync = () => {
            let time = 0;
            if (this.activeSource === 'yt' && ytPlayer && typeof ytPlayer.getPlayerState === 'function' && ytPlayer.getPlayerState() === 1) {
                time = ytPlayer.getCurrentTime();
            } else if (this.activeSource === 'file') {
                const localPlayer = document.getElementById('local-player');
                if(localPlayer) time = localPlayer.currentTime;
            }

            if (Math.abs(time - lastTime) < 0.01) {
                this.syncTimer = requestAnimationFrame(sync);
                return;
            }
            lastTime = time;

            if (window.parsedLines && time > 0) {
                let activeIndex = -1;
                const prev = window.currentActiveLineIndex;

                if (prev >= 0 && prev < window.parsedLines.length) {
                    const currentLine = window.parsedLines[prev];
                    const nextLine = window.parsedLines[prev + 1];
                    const currentEnd = currentLine.end || currentLine.start + 10;
                    
                    if (time >= currentLine.start && time < currentEnd) {
                        activeIndex = prev;
                    } else if (nextLine && time >= nextLine.start && time < (nextLine.end || nextLine.start + 10)) {
                        activeIndex = prev + 1;
                    }
                }

                if (activeIndex === -1) {
                    for (let i = window.parsedLines.length - 1; i >= 0; i--) {
                        if (time >= window.parsedLines[i].start) {
                            activeIndex = i; break;
                        }
                    }
                }

                if (activeIndex !== -1) {
                    const line = window.parsedLines[activeIndex];
                    const lineEnd = line.end || line.start + 10;
                    
                    if (time < lineEnd) {
                        if (window.currentActiveLineIndex !== activeIndex) {
                            if (activeLineContainer) activeLineContainer.classList.remove('active');
                            else document.querySelectorAll('.lyric-line.active').forEach(l => l.classList.remove('active'));
                            
                            activeLineContainer = document.getElementById(`line-${activeIndex}`);

                            if (activeLineContainer) {
                                activeLineContainer.classList.add('active');
                                
                                activeLineContainer.scrollIntoView({
                                    behavior: 'smooth',
                                    block: 'center'
                                });


                                activeWordElements = [];
                                if (line.words?.length) {
                                    for (let wi = 0; wi < line.words.length; wi++) {
                                        activeWordElements.push(document.getElementById(`word-${activeIndex}-${wi}`));
                                    }
                                }
                            }
                            window.currentActiveLineIndex = activeIndex;
                        }

                        if (line.words?.length) {
                            for (let wi = 0; wi < line.words.length; wi++) {
                                const wSpan = activeWordElements[wi]; 
                                if (wSpan) {
                                    const shouldBeActive = time >= line.words[wi].start;
                                    if (wSpan.classList.contains('active') !== shouldBeActive) {
                                        wSpan.classList.toggle('active', shouldBeActive);
                                    }
                                }
                            }
                        }
                    } else {
                        if (window.currentActiveLineIndex !== -1) {
                            if (activeLineContainer) activeLineContainer.classList.remove('active');
                            window.currentActiveLineIndex = -1;
                            activeLineContainer = null;
                            activeWordElements = [];
                        }
                    }
                }
            }
            
            this.syncTimer = requestAnimationFrame(sync);
        };

        this.syncTimer = requestAnimationFrame(sync);
    },
    
    stopSyncLoop() {
        if (this.syncTimer) {
            cancelAnimationFrame(this.syncTimer);
            this.syncTimer = null;
        }
    }
};

function onYouTubeIframeAPIReady() {
    let playerElementId = 'yt-player';
    if(!document.getElementById(playerElementId)) return;

    new YT.Player(playerElementId, {
        height: '100%', width: '100%', videoId: '',
        playerVars: { 'origin': window.location.origin, 'modestbranding': 1, 'playsinline': 1 },
        events: {
            'onReady': (e) => page.onPlayerReady(e),
            'onStateChange': (e) => {
                if (e.data === YT.PlayerState.PLAYING && document.body.id === 'page-submit') {
                    const dur = ytPlayer.getDuration();
                    const durInput = document.getElementById('sub-duration');
                    if (dur && !durInput.value) { durInput.value = Math.floor(dur); }
                }
                (e.data === YT.PlayerState.PLAYING) ? page.startSyncLoop() : page.stopSyncLoop();
            },
            'onError': (e) => page.handlePlayerError(e)
        }
    });
}

function initSubmitPage() {
    const audio = document.getElementById('local-player');
    const playBtn = document.getElementById('play-pause-btn');
    const progress = document.getElementById('progress-bar');
    const progressContainer = document.getElementById('progress-container');
    const timeCurr = document.getElementById('time-current');
    const timeTot = document.getElementById('time-total');

    if(!audio || !playBtn) return;

    playBtn.addEventListener('click', () => {
        if(audio.paused) audio.play();
        else audio.pause();
    });

    audio.addEventListener('play', () => {
        playBtn.innerHTML = '<span class="material-symbols-rounded">pause</span>';
        page.startSyncLoop();
    });
    
    audio.addEventListener('pause', () => {
        playBtn.innerHTML = '<span class="material-symbols-rounded">play_arrow</span>';
        page.stopSyncLoop();
    });

    audio.addEventListener('timeupdate', () => {
        const pct = (audio.currentTime / audio.duration) * 100;
        progress.style.width = pct + '%';
        timeCurr.innerText = formatPlayerTime(audio.currentTime);
        if(audio.duration && audio.duration !== Infinity) {
            timeTot.innerText = formatPlayerTime(audio.duration);
            document.getElementById('sub-duration').value = Math.floor(audio.duration);
        }
    });

    audio.addEventListener('loadedmetadata', () => {
         if(audio.duration && audio.duration !== Infinity) timeTot.innerText = formatPlayerTime(audio.duration);
    });

    progressContainer.addEventListener('click', (e) => {
        const rect = progressContainer.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        audio.currentTime = (clickX / rect.width) * audio.duration;
    });
}

function parseTimestamp(tsStr) {
    if (!tsStr) return 0;
    const parts = tsStr.replace(/[\[\]<>]/g, '').split(':');
    if (parts.length < 2) return 0;
    return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
}

function parseTTMLTime(tsStr) {
    if (!tsStr) return 0;
    if (tsStr.endsWith('ms')) return parseFloat(tsStr) / 1000;
    if (tsStr.endsWith('s')) return parseFloat(tsStr);
    const parts = tsStr.split(':').map(parseFloat);
    if (parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
    else if (parts.length === 2) return (parts[0] * 60) + parts[1];
    else if (parts.length === 1) return parts[0];
    return 0;
}

function formatELRCTime(sec) {
    if(isNaN(sec)) sec = 0;
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toFixed(3).padStart(6, '0');
    return `${m}:${s}`;
}

function formatTTMLTime(sec) {
    if(isNaN(sec)) sec = 0;
    const h = Math.floor(sec / 3600).toString().padStart(2, '0');
    const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
    const s = (sec % 60).toFixed(3).padStart(6, '0');
    return `${h}:${m}:${s}`;
}

function parseTTML(xmlText) {
    if(!xmlText.includes("</tt>")) xmlText += "</div></body></tt>"; 

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");
    const pTags = Array.from(xmlDoc.getElementsByTagName("p"));
    let parsed =[];

    pTags.forEach(p => {
        const start = parseTTMLTime(p.getAttribute("begin"));
        const end = parseTTMLTime(p.getAttribute("end"));
        const agent = p.getAttribute("ttm:agent") || "v1";
        let words =[];
        
        function traverse(node, isBg) {
            if (node.nodeName === 'span') {
                const nodeBg = isBg || node.getAttribute("ttm:role") === "x-bg";
                const hasChildSpans = Array.from(node.childNodes).some(n => n.nodeName === 'span');
                
                if (!hasChildSpans) {
                    const b = node.getAttribute("begin");
                    const e = node.getAttribute("end");
                    const text = node.textContent;
                    
                    if (text.trim() !== '') {
                        words.push({ 
                            start: parseTTMLTime(b) || start, 
                            end: parseTTMLTime(e) || null,
                            text: text, 
                            isBg: nodeBg 
                        });
                    }
                } else {
                    node.childNodes.forEach(child => traverse(child, nodeBg));
                }
            } else if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent;
                // Capture spacing that sits directly between span tags
                if (!text.trim() && text.length > 0 && words.length > 0) {
                    let lastWord = words[words.length - 1];
                    if (!lastWord.text.endsWith(' ')) lastWord.text += ' ';
                } else if (text.trim()) {
                    words.push({ start, end, text: text, isBg });
                }
            }
        }

        Array.from(p.childNodes).forEach(n => traverse(n, false));
        const lineText = words.map(w => w.text).join('').trim();

        parsed.push({ 
            start, 
            end: end || (words.length ? words[words.length-1].start + 2 : start + 5), 
            agent,
            text: lineText || p.textContent.trim().replace(/\s+/g, ' '), 
            words 
        });
    });
    return parsed;
}

function parseEnhancedLRC(rawText) {
    const lines = rawText.split('\n');
    let parsed =[];
    
    lines.forEach(line => {
        if (line.match(/^\[[a-zA-Z]+:/) && !line.match(/^\[(v\d+|[A-Za-z0-9_]+):/)) return;
        const matchLine = line.match(/^\[(\d{2}:\d{2}\.\d{2,3})\](?:([A-Za-z0-9_]+):)?(.*)/);
        
        if (matchLine) {
            const startTime = parseTimestamp(matchLine[1]);
            const agent = matchLine[2] || "v1";
            let content = matchLine[3];
            content = content.replace(/\[bg:(.*?)\]/g, '($1)');

            const words =[];
            let currentChunk = "";
            let isBg = false;

            for(let i=0; i<content.length; i++) {
                if(content[i] === '(') {
                    if(currentChunk) parseChunk(currentChunk, false, words, startTime);
                    currentChunk = "";
                    isBg = true;
                } else if (content[i] === ')') {
                    if(currentChunk) parseChunk(currentChunk, true, words, startTime);
                    currentChunk = "";
                    isBg = false;
                } else {
                    currentChunk += content[i];
                }
            }
            if(currentChunk) parseChunk(currentChunk, isBg, words, startTime);

            const plainText = content.replace(/<[^>]+>/g, '').replace(/[\(\)]/g, '').trim();
            const validWords =[];
            
            for (let i = 0; i < words.length; i++) {
                const w = words[i];
                if (w.text.trim() !== '') validWords.push(w);
                else if (validWords.length > 0) validWords[validWords.length - 1].end = w.start;
            }

            parsed.push({ start: startTime, text: plainText, words: validWords, agent });
        }
    });

    for (let i = 0; i < parsed.length; i++) {
        let e = parsed[i].start + 8;
        if(parsed[i].words.length > 0) {
            const lastWord = parsed[i].words[parsed[i].words.length-1];
            e = lastWord.end || (lastWord.start + 1.5);
        }
        if(parsed[i+1]) e = Math.min(e, parsed[i+1].start);
        parsed[i].end = e;
    }
    return parsed;
}

function parseChunk(text, isBg, wordsArr, lineStart) {
    const tagRegex = /<(\d{2}:\d{2}\.\d{2,3})>([^<]*)/g;
    let match;
    let foundAny = false;
    while ((match = tagRegex.exec(text)) !== null) {
        foundAny = true;
        wordsArr.push({ start: parseTimestamp(match[1]), text: match[2], isBg });
    }
    if(!foundAny && text.trim()) wordsArr.push({ start: lineStart, text: text, isBg });
}

function renderPreview(containerId = 'sync-preview-content') {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    
    if (!window.parsedLines || window.parsedLines.length === 0) {
        container.innerHTML = `<div class="empty-state text-muted">Invalid format or empty lyrics</div>`;
        return;
    }

    window.parsedLines.forEach((line, i) => {
        const div = document.createElement('div');
        div.className = 'lyric-line';
        if(line.agent && line.agent !== 'v1') div.classList.add(`agent-${line.agent}`);
        div.id = `line-${i}`;

        if (line.words && line.words.length > 0) {
            const mainContainer = document.createElement('div');
            mainContainer.className = 'main-vocals';
            const bgContainer = document.createElement('div');
            bgContainer.className = 'bg-vocals-container';

            line.words.forEach((w, wi) => {
                const span = document.createElement('span');
                span.className = 'lyric-word';
                if(w.isBg) span.classList.add('bg-vocal');
                span.id = `word-${i}-${wi}`;
                span.innerText = w.text;
                
                if (w.isBg) bgContainer.appendChild(span);
                else mainContainer.appendChild(span);
            });

            if (mainContainer.childNodes.length > 0) div.appendChild(mainContainer);
            if (bgContainer.childNodes.length > 0) div.appendChild(bgContainer);
        } else {
            div.innerText = line.text;
        }
        container.appendChild(div);
    });
}

function updateSyncPreview() {
    const text = document.getElementById('sub-lyrics').value;
    if (!text.trim()) {
        document.getElementById('sync-preview-content').innerHTML = `<div class="empty-state text-muted">Lyrics will animate here</div>`;
        return;
    }
    
    const isTTML = text.trim().startsWith('<?xml') || text.trim().startsWith('<tt');
    if (!isTTML && !hasWarnedELRC) {
        showToast("We highly recommend using TTML Format instead of LRC/ELRC for precise accuracy.", "info");
        hasWarnedELRC = true; 
    }

    window.parsedLines = isTTML ? parseTTML(text) : parseEnhancedLRC(text);
    renderPreview();
}

function handleLyricsFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('sub-lyrics').value = e.target.result;
        updateSyncPreview();
    };
    reader.readAsText(file);
    event.target.value = '';
}

function generatePayloadFromParsed(target) {
    if (target === 'ttml') {
        let xml = `<?xml version="1.0" encoding="utf-8"?>\n<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:ttp="http://www.w3.org/ns/ttml#parameter" ttp:timeBase="media" xml:lang="en">\n  <head>\n    <metadata>\n`;
        
        let agents = new Set(window.parsedLines.map(l => l.agent || 'v1'));
        agents.forEach(a => {
            const name = a === 'v1' ? 'Lead' : `Vocal ${a.replace('v', '')}`;
            xml += `      <ttm:agent xml:id="${a}" type="person"><ttm:name>${name}</ttm:name></ttm:agent>\n`;
        });
        xml += `    </metadata>\n  </head>\n  <body>\n    <div>\n`;

        window.parsedLines.forEach(line => {
            xml += `      <p begin="${formatTTMLTime(line.start)}" end="${formatTTMLTime(line.end)}" ttm:agent="${line.agent || 'v1'}">`;
            if (line.words.length > 0) {
                let insideBg = false;
                line.words.forEach((word, i) => {
                    const wordEnd = word.end ? word.end : (line.words[i+1] ? line.words[i+1].start : line.end);
                    const safeText = word.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    if (!safeText.trim() && safeText.length === 0) return;

                    if (word.isBg && !insideBg) { xml += `<span ttm:role="x-bg">`; insideBg = true; }
                    if (!word.isBg && insideBg) { xml += `</span>`; insideBg = false; }
                    
                    xml += `<span begin="${formatTTMLTime(word.start)}" end="${formatTTMLTime(wordEnd)}">${safeText}</span>`;
                });
                if (insideBg) xml += `</span>`;
            } else {
                xml += line.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            }
            xml += `</p>\n`;
        });

        xml += `    </div>\n  </body>\n</tt>`;
        document.getElementById('sub-lyrics').value = xml;
    } else if (target === 'elrc') {
        let elrcStr = "";
        window.parsedLines.forEach(line => {
            const ts = formatELRCTime(line.start);
            elrcStr += `[${ts}]`;
            
            if (line.agent && line.agent !== 'v1') elrcStr += `${line.agent}:`;

            if (line.words.length > 0) {
                let insideBg = false;
                line.words.forEach((w) => {
                    if (w.isBg && !insideBg) { elrcStr += "[bg:"; insideBg = true; }
                    if (!w.isBg && insideBg) { elrcStr += "]"; insideBg = false; }
                    
                    const safeText = w.text;
                    const endTs = w.end ? `<${formatELRCTime(w.end)}>` : '';
                    elrcStr += `<${formatELRCTime(w.start)}>${safeText}${endTs}`;
                });
                if(insideBg) elrcStr += "]";
            } else {
                elrcStr += line.text;
            }
            elrcStr += "\n";
        });
        document.getElementById('sub-lyrics').value = elrcStr.trim();
    }
    updateSyncPreview();
}

function convertLyrics(target) {
    const rawText = document.getElementById('sub-lyrics').value;
    if (!rawText.trim()) return showToast("Please paste or upload lyrics first.", "error");

    const isCurrentTTML = rawText.trim().startsWith('<?xml') || rawText.trim().startsWith('<tt');
    window.parsedLines = isCurrentTTML ? parseTTML(rawText) : parseEnhancedLRC(rawText);

    if (!window.parsedLines.length) return showToast("Could not extract valid lyric timings.", "error");
    
    generatePayloadFromParsed(target);
    showToast(`Converted to standard ${target.toUpperCase()} Format!`, "success");
}

window.fixLyricsFormatting = function() {
    const rawText = document.getElementById('sub-lyrics').value;
    if (!rawText.trim()) return showToast("Please paste or upload lyrics first.", "error");

    const isTTML = rawText.trim().startsWith('<?xml') || rawText.trim().startsWith('<tt');
    window.parsedLines = isTTML ? parseTTML(rawText) : parseEnhancedLRC(rawText);

    if (!window.parsedLines || !window.parsedLines.length) return showToast("No parsed lyrics to fix.", "error");

    let fixedCount = 0;
    window.parsedLines.forEach(line => {
        if (line.words && line.words.length > 0) {
            for (let i = 0; i < line.words.length; i++) {
                let w = line.words[i];
                w.text = w.text.trim();
                if (i < line.words.length - 1) w.text += ' ';
            }
            const newText = line.words.map(w => w.text).join('');
            if (line.text !== newText.trim()) {
                fixedCount++;
                line.text = newText.trim();
            }
        }
    });

    if (fixedCount > 0) {
        generatePayloadFromParsed(isTTML ? 'ttml' : 'elrc');
        showToast(`Formatting fixed! Adjusted spacing on ${fixedCount} lines.`, "success");
    } else {
        showToast("Formatting is already perfect! No missing spaces found.", "info");
    }
}


document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.code === 'Space') {
        e.preventDefault(); 
        if (page && page.activeSource === 'yt' && ytPlayer && typeof ytPlayer.getPlayerState === 'function') {
            const state = ytPlayer.getPlayerState();
            if (state === 1) ytPlayer.pauseVideo();
            else ytPlayer.playVideo();
        } 
        else {
            const localAudio = document.getElementById('local-player');
            if (localAudio) {
                if (localAudio.paused) localAudio.play();
                else localAudio.pause();
            }
        }
    }
});

window.toggleRawPayload = function() {
    const body = document.getElementById('raw-payload-body');
    const icon = document.getElementById('raw-toggle-icon');
    if (body.classList.contains('hidden')) {
        body.classList.remove('hidden');
        icon.innerText = 'expand_less';
    } else {
        body.classList.add('hidden');
        icon.innerText = 'expand_more';
    }
}

async function submitLyricsForm() {
    const vid = document.getElementById('sub-vid').value.trim();
    const song = document.getElementById('sub-song').value.trim();
    const artist = document.getElementById('sub-artist').value.trim();
    const durStr = document.getElementById('sub-duration').value.trim();
    const lyrics = document.getElementById('sub-lyrics').value.trim();
    const btn = document.getElementById('submit-btn');

    if(!vid && page.activeSource === 'yt') return showToast("Please provide a valid YouTube URL.", "error");
    if(!song || !artist || !durStr || !lyrics) return showToast("Please fill in all required fields.", "error");
    
    let format = (lyrics.trim().startsWith('<?xml') || lyrics.trim().startsWith('<tt')) ? 'ttml' : 'lrc';

    try {
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-rounded spinner">sync</span> Publishing...';

        const payload = {
            videoId: vid || "local-file", 
            song, artist, lyrics, format,
            duration: parseInt(durStr, 10),
            language: "en",
            syncType: format === 'ttml' ? 'richsync' : 'linesync'
        };

        await apiSignedAction('/submit', payload);
        showToast("Successfully published!", "success");
        setTimeout(() => window.location.href = 'index.html', 1500);
    } catch(e) {
        showToast("Submission failed: " + e.message, "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-rounded">publish</span> Publish to Unison';
    }
}


window.openFeedbackHub = function() {
    renderFeedbackList();
    document.getElementById('feedback-dialog').showModal();
};

window.submitFeedback = async function() {
    const input = document.getElementById('feedback-input');
    const text = input.value.trim();
    if (!text) return showToast('Please enter some feedback first.', 'error');

    const user = JSON.parse(localStorage.getItem('unisonIdentity'));
    const displayName = user ? user.displayName : 'Anonymous';
    
    input.disabled = true;

    try {
        const response = await fetch(FEEDBACK_API_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}` 
            },
            body: JSON.stringify({ text, username: displayName })
        });

        if (!response.ok) throw new Error("Failed to reach server");

        input.value = '';
        showToast('Feedback successfully sent to Unison developers!', 'success');
        
        await renderFeedbackList();

    } catch (err) {
        showToast('Server error: Could not transmit feedback.', 'error');
    } finally {
        input.disabled = false;
    }
};

window.renderFeedbackList = async function() {
    const list = document.getElementById('feedback-list');
    if (!list) return;

    list.innerHTML = '<div class="empty-state text-muted" style="min-height: 100px; font-size: 0.9rem;"><span class="material-symbols-rounded spinner" style="margin-right:8px; font-size: 16px; vertical-align: middle;">sync</span> Loading database...</div>';

    try {
        const response = await fetch(FEEDBACK_API_URL, { 
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        
        if (!response.ok) throw new Error("Failed to fetch");
        
        const feedbacks = await response.json();
        
        if (!feedbacks || !feedbacks.length) {
            list.innerHTML = '<div class="empty-state text-muted" style="min-height: 100px; font-size: 0.9rem;">No feedback left yet.</div>';
            return;
        }
        
        list.innerHTML = feedbacks.map(fb => {
            const dateObj = new Date(fb.created_at);
            const dateStr = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
            return `
            <div class="panel" style="padding: 12px; border-radius: 8px;">
                <div style="font-size: 0.95rem; margin-bottom: 6px;">${fb.text}</div>
                <div class="text-muted" style="font-size: 0.75rem;">By <b>${fb.username || 'Anonymous'}</b> on ${dateStr}</div>
            </div>
            `;
        }).join('');

    } catch(err) {
        list.innerHTML = '<div class="empty-state text-muted" style="min-height: 100px; font-size: 0.9rem; color: var(--danger);">Failed to load feedback from server.</div>';
    }
};


function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 120;
            const MAX_HEIGHT = 120;
            canvas.width = MAX_WIDTH;
            canvas.height = MAX_HEIGHT;

            const ctx = canvas.getContext('2d');
            const size = Math.min(img.width, img.height);
            const x = (img.width - size) / 2;
            const y = (img.height - size) / 2;
            
            ctx.drawImage(img, x, y, size, size, 0, 0, MAX_WIDTH, MAX_HEIGHT);

            const base64Data = canvas.toDataURL('image/jpeg', 0.8);
            
            localStorage.setItem('unisonAvatar', base64Data);
            const preview = document.getElementById('acc-avatar-preview');
            if (preview) preview.src = base64Data;
            showToast("Avatar updated successfully!", "success");
            
            logCurrentUser(); 
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

async function logCurrentUser() {
    const user = JSON.parse(localStorage.getItem('unisonIdentity'));
    if (!user) return;
    
    const avatarData = localStorage.getItem('unisonAvatar');
    
    try {
        await fetch(USERS_API_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}` 
            },
            body: JSON.stringify({ 
                username: user.displayName || 'Unknown User',
                keyId: user.keyId,
                avatarData: avatarData || BETTER_LYRICS_LOGO
            })
        });
    } catch(e) {
        console.warn("Could not log user presence", e);
    }
}

async function loadActiveUsers() {
    const list = document.getElementById('active-users-list');
    if (!list) return;

    try {
        logCurrentUser();

        const response = await fetch(USERS_API_URL, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
        });

        if (!response.ok) throw new Error("Failed to fetch users");
        const users = await response.json();
        
        if (!users || !users.length) {
            list.innerHTML = '<div class="empty-state text-muted" style="min-height: 100px;">No other members online right now.</div>';
            return;
        }
        
        list.innerHTML = '';
        users.forEach((u, index) => {
            const delay = index * 0.05;

            const isDefaultUser = u.key_id === DEFAULT_IDENTITY.keyId;
            const imgSrc = isDefaultUser 
                ? BETTER_LYRICS_LOGO 
                : u.avatar_data || BETTER_LYRICS_LOGO;
            
            const userCard = document.createElement("div");
            userCard.className = "user-card animate-fade-up";
            userCard.style.animationDelay = `${delay}s;`;

            const userAvatar = document.createElement("div");
            userAvatar.className = "user-avatar";
            
            const userAvatarImg = document.createElement("img");
            userAvatarImg.src = imgSrc;
            userAvatarImg.alt = u.username;
            
            userAvatar.appendChild(userAvatarImg);
            userCard.appendChild(userAvatar);

            const userInfo = document.createElement("div");
            userInfo.className = "user-info";

            const userName = document.createElement("div");
            userName.className = "user-name";
            userName.innerText = u.username || "Anonymous";
            userInfo.appendChild(userName);

            const userStatus = document.createElement("div");
            userStatus.className = "user-status"

            const userStatusDot = document.createElement("div")
            userStatusDot.className = "status-dot"
            
            userStatus.appendChild(userStatusDot);
            userStatus.innerHTML += "Active"

            userInfo.appendChild(userStatus);
            userCard.appendChild(userInfo);
            userCard.addEventListener("click", () => {
                window.location.href = `submissions.html?id=${u.key_id}&name=${u.username}`
            });
            list.appendChild(userCard);
        });
    } catch(err) {
        list.innerHTML = `<div class="empty-state text-muted" style="min-height: 100px; color: var(--danger);">Failed to load community members.</div>`;
    }
}

window.unison_external_submit = async function(payload) {
    if (!payload) {
        console.error("Unison: No payload provided.");
        return;
    }

    const { identity, youtubeUrl } = payload;

    try {
        if (identity) {
            if (identity.keyId && identity.privateKey) {
                localStorage.setItem('unisonIdentity', JSON.stringify(identity));
                console.log("Unison: Identity injected successfully.");
            } else {
                throw new Error("Invalid identity format provided by extension.");
            }
        }

        if (document.body.id !== 'page-submit') {
            console.log("Unison: Redirecting to Submit page now that identity is set...");
            window.location.href = 'submit.html';
            return; 
        }

        if (youtubeUrl) {
            const urlInput = document.getElementById('sub-url-input');
            if (urlInput) urlInput.value = youtubeUrl;
            
            page.parseYoutubeUrl(youtubeUrl);
            
            showToast("Data received from extension!", "success");
        } else {
            showToast("Identity updated!", "success");
        }

    } catch (err) {
        console.error("Unison External Error:", err);
        showToast("Failed to import extension data: " + err.message, "error");
    }
};
