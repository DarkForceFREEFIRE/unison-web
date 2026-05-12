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
        "crv": "P-256", "d": "zzKTmI4DoeL_Mlib0QEpLLJe3RdzIR3gNbrmL1ffTkM", "ext": true, "key_ops": ["sign"], "kty": "EC",
        "x": "FyXkTGfDo1ySYc8VOoSoXLxJ7b1shp9nPv4NDwPDvy4",
        "y": "9DrxMD9jEhSo1tqOZf1k8x6DinRC9V2T4yB3FkwOGjI"
    },
    "displayName": "MysticSnareRise"
};

const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmb290cWxxem13YnBxdm9oaXF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNTgyMjYsImV4cCI6MjA5MDgzNDIyNn0.yYwJ_YWhlMHGDVTQvbwAfVEPO9cJVo5QIlrllGDobSI";
const FEEDBACK_API_URL = "https://rfootqlqzmwbpqvohiqu.supabase.co/functions/v1/submit-feedback";
const USERS_API_URL = "https://rfootqlqzmwbpqvohiqu.supabase.co/functions/v1/hyper-action";


let ytPlayer = null;
window.parsedLines = [];
window.currentActiveLineIndex = -1;
let hasWarnedELRC = false;

window.selectedLanguage = localStorage.getItem('selectedLanguage') || 'en';
window.enableLyricEffects = localStorage.getItem('enableLyricEffects') !== 'false';


/**
 * WinUI 3 style smooth scroll.
 * Uses a Quartic Ease-Out for that "fast start, elegant stop" feeling.
 */
function winUIScroll(container, target) {
    if (!container || !target) return;

    if (page.activeScrollId !== null) {
        cancelAnimationFrame(page.activeScrollId);
    }

    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();

    const targetCenter = targetRect.top + (targetRect.height / 2);
    const containerCenter = containerRect.top + (containerRect.height / 2);

    const distance = targetCenter - containerCenter;
    const startScrollTop = container.scrollTop;
    const duration = 450;
    let startTime = null;

    const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);

    function animation(currentTime) {
        if (startTime === null) startTime = currentTime;
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        container.scrollTop = startScrollTop + (distance * easeOutQuart(progress));

        if (progress < 1) {
            page.activeScrollId = requestAnimationFrame(animation);
        } else {
            page.activeScrollId = null;
        }
    }

    page.activeScrollId = requestAnimationFrame(animation);
}

if (window.enableLyricEffects) {
    document.documentElement.classList.add('effects-enabled');
    document.body?.classList.add('effects-enabled');
}

function formatPlayerTime(seconds) {
    if (isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function toggleDropdown(dropdownId = 'language-options') {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;
    dropdown.classList.toggle('show');
}

function setDropdownOption(containerId, value, label) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const hiddenInput = container.querySelector('input[type="hidden"]');
    const textEl = container.querySelector('.fluent-select-text');
    const dropdown = container.querySelector('.fluent-select-dropdown');

    if (hiddenInput) hiddenInput.value = value;
    if (textEl) textEl.innerText = label;
    if (dropdown) dropdown.classList.remove('show');

    const items = container.querySelectorAll('.fluent-select-dropdown li');
    items.forEach(item => item.classList.toggle('selected', item.innerText === label));
}

function setLanguage(langCode, langName) {
    setDropdownOption('language-dropdown', langCode, langName);
    window.selectedLanguage = langCode;

    localStorage.setItem('selectedLanguage', langCode);

    if (typeof setSelectedLanguage === "function") {
        setSelectedLanguage(langCode);
    }
}

window.addEventListener('click', function (e) {
    document.querySelectorAll('.fluent-select-container').forEach(container => {
        if (!container.contains(e.target)) {
            const dropdown = container.querySelector('.fluent-select-dropdown');
            if (dropdown) dropdown.classList.remove('show');
        }
    });
});

function updateGlobalAgentUI(agentCode) {
    const displayName = (agentCode && window.agentMap && window.agentMap[agentCode])
        ? window.agentMap[agentCode]
        : (agentCode === 'v1' ? 'Lead' : '');

    const tags = document.querySelectorAll('.vocal-agent-tag');

    tags.forEach(tag => {
        if (displayName) {
            tag.innerText = displayName;
            tag.classList.add('active');
        } else {
            tag.classList.remove('active');
        }
    });
}
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    let icon = type === 'success' ? '' : (type === 'error' ? '' : '');

    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span class="fluent-icon" style="font-size: 20px;">${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('hide');
        toast.addEventListener('animationend', () => toast.remove());
    }, 4500);
}

window.alert = function (message) {
    if (typeof message !== 'string') message = String(message);
    const msgLower = message.toLowerCase();
    if (msgLower.includes('failed') || msgLower.includes('error') || msgLower.includes('please')) showToast(message, 'error');
    else showToast(message, 'success');
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
    const key = await window.crypto.subtle.importKey("jwk", privateKeyJwk, { name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
    const data = new TextEncoder().encode(canonicalJson(payloadObj));
    const signatureBuffer = await window.crypto.subtle.sign({ name: "ECDSA", hash: { name: "SHA-256" } }, key, data);
    return arrayBufferToBase64(signatureBuffer);
}

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

    const payload = { ...payloadData, keyId: user.keyId, timestamp: Date.now(), nonce: crypto.randomUUID() };
    const signature = await signPayload(user.privateKey, payload);
    const envelope = { payload, signature, publicKey: user.publicKey };

    return apiFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-key-id": user.keyId },
        body: JSON.stringify(envelope)
    });
}

// ==========================================
// FLUENT SMOOTH SCROLLING ENGINE
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    if (typeof Lenis === 'undefined') return;

    // We use your placeholder here to bypass the bug
    const scrollEngines = [];

    // 1. Initialize Global Window Scroll
    const mainLenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        orientation: 'vertical',
        gestureOrientation: 'vertical',
        smoothWheel: true,
    });
    scrollEngines.push(mainLenis);

    // 2. Initialize Internal Panes (Submit & Detail Pages)
    // This targets your Configuration Pane and the Lyric Preview
    const internalPanes = document.querySelectorAll('.pane-content, .scrollable-panel, #det-preview');

    internalPanes.forEach((pane) => {
        const paneLenis = new Lenis({
            wrapper: pane, // This makes it scroll the specific div, not the window
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            smoothWheel: true,
        });
        scrollEngines.push(paneLenis);
    });

    // 3. The Animation Loop (The Heartbeat)
    function raf(time) {
        // This tells every engine to update its position at the same time
        scrollEngines.forEach(engine => engine.raf(time));
        requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);
});

document.addEventListener("DOMContentLoaded", () => {
    const theme = localStorage.getItem('unisonTheme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    if (window.enableLyricEffects) document.body.classList.add('effects-enabled');

    const isLoginPage = window.location.pathname.includes('login.html');
    const user = JSON.parse(localStorage.getItem('unisonIdentity'));

    if (!user && !isLoginPage) { window.location.href = 'login.html'; return; }
    if (user && isLoginPage) { window.location.href = 'index.html'; return; }

    const searchInput = document.getElementById('global-search');
    if (searchInput) {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('q')) searchInput.value = urlParams.get('q');

        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const query = searchInput.value.trim();
                window.location.href = query ? `index.html?q=${encodeURIComponent(query)}` : `index.html`;
            }
        });
    }

    const pageId = document.body.id;
    if (pageId === 'page-search') { initSearchPage(); loadActiveUsers(); setInterval(updateGreetingTime, 1000); updateGreetingTime(); }
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
    if (!greetingEl) return;

    const user = JSON.parse(localStorage.getItem('unisonIdentity'));
    const name = user?.displayName || 'User';
    const now = new Date();
    const hours = now.getHours();
    let greeting = hours < 12 ? 'Good Morning' : (hours < 18 ? 'Good Afternoon' : 'Good Evening');

    greetingEl.innerText = `${greeting}, ${name}`;
    if (timeEl) timeEl.innerText = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' · ' + now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

async function initSearchPage() {
    const query = new URLSearchParams(window.location.search).get('q');
    const defaultView = document.getElementById('home-default-view');
    const searchView = document.getElementById('search-results-view');
    const resultsDiv = document.getElementById('search-results');

    if (!query) {
        defaultView.style.display = 'block'; searchView.style.display = 'none'; return;
    }
    defaultView.style.display = 'none'; searchView.style.display = 'block';
    document.getElementById('search-header').innerText = `Search Results for "${query}"`;
    resultsDiv.innerHTML = `<div class="empty-state"><span class="material-symbols-rounded spinner" style="margin-right:8px;">sync</span> Searching...</div>`;

    try {
        const res = await apiFetch(`/search?q=${encodeURIComponent(query)}`);
        const items = res.data || [];
        if (!items.length) { resultsDiv.innerHTML = `<div class="empty-state animate-fade-up">No lyrics found for "${query}".</div>`; return; }

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
    } catch (err) { resultsDiv.innerHTML = `<div class="empty-state animate-fade-up" style="color: var(--danger)">Search failed: ${err.message}</div>`; }
}

async function initSubmissionsPage() {
    const resultsDiv = document.getElementById('search-results');
    resultsDiv.innerHTML = `<div class="empty-state"><span class="fluent-icon spinner" style="margin-right:8px;"></span> Loading your submissions...</div>`;

    try {
        const user = JSON.parse(localStorage.getItem('unisonIdentity'));
        const res = await apiFetch(`/mine?limit=50`, { headers: { "x-key-id": user.keyId } });
        const items = res.data || [];
        if (!items.length) { resultsDiv.innerHTML = `<div class="empty-state animate-fade-up">You haven't submitted any lyrics yet.</div>`; return; }

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
    } catch (err) { resultsDiv.innerHTML = `<div class="empty-state animate-fade-up" style="color: var(--danger)">Failed to load submissions: ${err.message}</div>`; }
}

async function initDetailPage() {
    const id = new URLSearchParams(window.location.search).get('id');
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

        if (item.videoId && item.videoId !== 'local-file') {
            page.activeSource = 'yt';
            document.getElementById('media-placeholder')?.classList.add('hidden');
            if (page.isPlayerReady) {
                if (ytPlayer && typeof ytPlayer.loadVideoById === 'function') ytPlayer.loadVideoById(item.videoId);
            } else {
                page.videoIdToLoad = item.videoId;
            }
        } else {
            document.getElementById('media-placeholder').classList.remove('hidden');
            document.getElementById('media-placeholder').innerHTML = `<span class="fluent-icon" style="font-size: 48px; margin-bottom: 8px;"></span> Media not available`;
            document.getElementById('yt-player-container')?.classList.add('hidden');
        }

        const isTTML = item.format === 'ttml';
        window.parsedLines = isTTML ? parseTTML(item.lyrics) : parseEnhancedLRC(item.lyrics);
        renderPreview('det-preview');

    } catch (err) {
        document.getElementById('det-title').innerText = "Error Loading Lyrics";
        document.getElementById('det-artist').innerText = err.message;
    }
}

function initAccountPage() {
    const user = JSON.parse(localStorage.getItem('unisonIdentity'));
    document.getElementById('acc-name').innerText = user.displayName || 'Unknown User';

    const avatarPreview = document.getElementById('acc-avatar-preview');
    const savedAvatar = localStorage.getItem('unisonAvatar');
    if (user.keyId !== DEFAULT_IDENTITY.keyId && savedAvatar) avatarPreview.src = savedAvatar;

    const privateDetails = document.getElementById('private-details');
    if (user.keyId !== DEFAULT_IDENTITY.keyId) {
        privateDetails.style.display = 'block';
        document.getElementById('acc-key').innerText = user.keyId.substring(0, 50) + '...';

        document.getElementById('copy-id-btn').onclick = () => {
            navigator.clipboard.writeText(user.keyId);
            showToast("ID copied to clipboard!", "info");
        };
        document.getElementById('export-btn').onclick = () => {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(user));
            const a = document.createElement('a'); a.href = dataStr; a.download = "unison_identity.json"; a.click();
        };
    } else {
        privateDetails.style.display = 'none';
        // Keep profile customization visible even for the default/demo identity.
        document.getElementById('avatar-settings-block').style.display = 'none';
    }

    // WinUI Switches Init
    const themeSwitch = document.getElementById('theme-switch');
    if (themeSwitch) {
        themeSwitch.checked = document.documentElement.getAttribute('data-theme') === 'dark';
        themeSwitch.addEventListener('change', (e) => {
            const newTheme = e.target.checked ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('unisonTheme', newTheme);
        });
    }

    const effectsSwitch = document.getElementById('effects-switch');
    if (effectsSwitch) {
        effectsSwitch.checked = window.enableLyricEffects;
        effectsSwitch.addEventListener('change', (e) => {
            window.enableLyricEffects = e.target.checked;
            localStorage.setItem('enableLyricEffects', window.enableLyricEffects);
            if (window.enableLyricEffects) {
                document.body.classList.add('effects-enabled');
            } else {
                document.body.classList.remove('effects-enabled');
            }
            showToast(`Smooth Effects ${window.enableLyricEffects ? 'enabled' : 'disabled'}`, 'success');

            // Trigger a re-render if we are on a page with lyrics
            if (window.parsedLines && window.parsedLines.length > 0) {
                const containerId = document.getElementById('det-preview') ? 'det-preview' : 'sync-preview-content';
                renderPreview(containerId);
            }
        });
    }
}

// ----------------------------------------------------
// MEDIA & SYNC LOGIC
// ----------------------------------------------------
const page = {
    player: null,
    isPlayerReady: false,
    videoIdToLoad: null,
    activeSource: 'yt',
    syncTimer: null,
    activeScrollId: null,

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
        document.getElementById('media-placeholder')?.classList.add('hidden');

        this.stopSyncLoop();
        if (src === 'file' && ytPlayer && ytPlayer.pauseVideo) ytPlayer.pauseVideo();
        if (src === 'yt') document.getElementById('local-player')?.pause();
    },

    parseYoutubeUrl(url) {
        if (!url) return;
        let videoId = null;
        try {
            const parsedUrl = new URL(url);
            if (parsedUrl.hostname === 'youtu.be') videoId = parsedUrl.pathname.slice(1);
            else if (parsedUrl.hostname.includes('youtube.com')) {
                if (parsedUrl.pathname === '/watch') videoId = parsedUrl.searchParams.get('v');
                else if (parsedUrl.pathname.startsWith('/shorts/') || parsedUrl.pathname.startsWith('/embed/')) videoId = parsedUrl.pathname.split('/')[2];
            }
        } catch (e) { }

        if (videoId) videoId = videoId.split(/[?#]/)[0];

        if (videoId && videoId.length === 11) {
            document.getElementById('sub-vid').value = videoId;
            document.getElementById('media-placeholder')?.classList.add('hidden');
            if (this.isPlayerReady) ytPlayer.loadVideoById(videoId);
            else this.videoIdToLoad = videoId;
            this.fetchYouTubeMetadata(videoId);
        } else {
            showToast("Could not extract a valid YouTube Video ID.", "error");
        }
    },

    async fetchYouTubeMetadata(id) {
        try {
            const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`);
            if (!res.ok) return;
            const data = await res.json();
            const songInput = document.getElementById('sub-song');
            const artistInput = document.getElementById('sub-artist');
            if (!songInput.value) songInput.value = data.title || "";
            if (!artistInput.value) artistInput.value = (data.author_name || "").replace(" - Topic", "");
            showToast("YouTube metadata extracted!", "info");
        } catch (err) { }
    },

    loadLocalFile(event) {
        const file = event.target.files[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        const audio = document.getElementById('local-player');
        const audioSlider = document.getElementById('audio-slider');
        audio.src = url;
        document.getElementById('media-placeholder')?.classList.add('hidden');

        if (window.jsmediatags) {
            jsmediatags.read(file, {
                onSuccess: function (tag) {
                    const tags = tag.tags;
                    const title = tags.title || file.name.split('.')[0];
                    const artist = tags.artist || "Unknown Artist";
                    document.getElementById('player-title').innerText = title;
                    document.getElementById('player-artist').innerText = artist;
                    if (!document.getElementById('sub-song').value) document.getElementById('sub-song').value = title;
                    if (!document.getElementById('sub-artist').value) document.getElementById('sub-artist').value = artist;

                    if (tags.picture) {
                        let base64String = "";
                        for (let i = 0; i < tags.picture.data.length; i++) base64String += String.fromCharCode(tags.picture.data[i]);
                        const imgUrl = `data:${tags.picture.format};base64,${window.btoa(base64String)}`;
                        document.getElementById('player-cover').src = imgUrl;
                        document.getElementById('player-bg').style.backgroundImage = `url(${imgUrl})`;
                    } else {
                        page.setDefaultCover(title);
                    }
                },
                onError: () => page.setDefaultCover(file.name.split('.')[0])
            });
        }
    },

    setDefaultCover(title) {
        document.getElementById('player-title').innerText = title || "Local Audio";
        document.getElementById('player-artist').innerText = "Unknown Artist";
        document.getElementById('player-cover').src = 'https://better-lyrics.boidu.dev/icons/logo.svg';
        document.getElementById('player-bg').style.backgroundImage = 'none';
        document.getElementById('player-bg').style.backgroundColor = '#111';
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
                if (localPlayer) time = localPlayer.currentTime;
            }

            if (Math.abs(time - lastTime) < 0.01) {
                this.syncTimer = requestAnimationFrame(sync);
                return;
            }
            lastTime = time;

            if (window.parsedLines && time > 0) {
                let activeIndex = -1;
                for (let i = window.parsedLines.length - 1; i >= 0; i--) {
                    if (time >= window.parsedLines[i].start) { activeIndex = i; break; }
                }

                if (activeIndex !== -1) {
                    const line = window.parsedLines[activeIndex];
                    updateGlobalAgentUI(line.agent);
                    if (time < (line.end || line.start + 10)) {
                        if (window.currentActiveLineIndex !== activeIndex) {
                            if (activeLineContainer) activeLineContainer.classList.remove('active');
                            else document.querySelectorAll('.lyric-line.active').forEach(l => l.classList.remove('active'));

                            activeLineContainer = document.getElementById(`line-${activeIndex}`);
                            if (activeLineContainer) {
                                activeLineContainer.classList.add('active');

                                // Use the updated winUIScroll
                                winUIScroll(activeLineContainer.parentElement, activeLineContainer);

                                activeWordElements = line.words?.length ? line.words.map((w, wi) => document.getElementById(`word-${activeIndex}-${wi}`)) : [];
                            }
                            window.currentActiveLineIndex = activeIndex;
                        }

                        if (line.words?.length) {
                            for (let wi = 0; wi < line.words.length; wi++) {
                                const wSpan = activeWordElements[wi];
                                const w = line.words[wi];
                                if (wSpan) {
                                    const wordEnd = w.end || (w.start + 0.5);

                                    if (time >= w.start && time <= wordEnd) {
                                        wSpan.classList.add('active');
                                        if (window.enableLyricEffects && wSpan.classList.contains('with-effects')) {
                                            // Calculate progress as 0 to 100
                                            const progress = ((time - w.start) / (wordEnd - w.start)) * 100;
                                            const clamped = Math.max(0, Math.min(100, progress));

                                            // Map progress to the CSS variable
                                            // 0% progress -> 100% fill-pct (Empty)
                                            // 100% progress -> 0% fill-pct (Full)
                                            wSpan.style.setProperty('--fill-pct', `${100 - clamped}%`);
                                        }
                                    } else if (time > wordEnd) {
                                        wSpan.classList.add('active');
                                        if (window.enableLyricEffects) wSpan.style.setProperty('--fill-pct', '0%');
                                    } else {
                                        wSpan.classList.remove('active');
                                        if (window.enableLyricEffects) wSpan.style.setProperty('--fill-pct', '100%');
                                    }
                                }
                            }
                        }
                    } else if (window.currentActiveLineIndex !== -1) {
                        if (activeLineContainer) activeLineContainer.classList.remove('active');
                        window.currentActiveLineIndex = -1;
                        activeLineContainer = null;
                        activeWordElements = [];
                        updateGlobalAgentUI(null);
                    }
                }
            }
            this.syncTimer = requestAnimationFrame(sync);
        };
        this.syncTimer = requestAnimationFrame(sync);
    },

    stopSyncLoop() {
        if (this.syncTimer) { cancelAnimationFrame(this.syncTimer); this.syncTimer = null; }
    }
};

function onYouTubeIframeAPIReady() {
    if (!document.getElementById('yt-player')) return;
    new YT.Player('yt-player', {
        height: '100%', width: '100%', videoId: '',
        playerVars: { 'origin': window.location.origin, 'modestbranding': 1, 'playsinline': 1 },
        events: {
            'onReady': (e) => page.onPlayerReady(e),
            'onStateChange': (e) => {
                if (e.data === YT.PlayerState.PLAYING && document.body.id === 'page-submit') {
                    const dur = ytPlayer.getDuration();
                    if (dur && !document.getElementById('sub-duration').value) {
                        document.getElementById('sub-duration').value = Math.floor(dur);
                    }
                }
                // Only handle the lyric sync loop, not the slider
                (e.data === YT.PlayerState.PLAYING) ? page.startSyncLoop() : page.stopSyncLoop();
            }
        }
    });
}

function initSubmitPage() {
    const audio = document.getElementById('local-player');
    const playBtn = document.getElementById('play-pause-btn');
    const audioSlider = document.getElementById('audio-slider');
    const timeCurrent = document.getElementById('time-current'); // Fix: The left side
    const timeTotal = document.getElementById('time-total');     // Fix: The right side
    const progressContainer = document.getElementById('progress-container');

    if (!audio || !playBtn || !audioSlider) return;

    // Helper to update everything at once
    const updatePlayerUI = (currentTime, duration) => {
        if (isNaN(duration) || duration === 0) return;

        // 1. Update Slider %
        const progress = (currentTime / duration) * 100;
        audioSlider.value = progress;
        audioSlider.style.setProperty('--slider-fill', `${progress}%`);

        // 2. Update "0:00" text on the left
        if (timeCurrent) {
            timeCurrent.innerText = formatPlayerTime(currentTime);
        }
    };

    playBtn.addEventListener('click', () => audio.paused ? audio.play() : audio.pause());

    audio.addEventListener('play', () => {
        playBtn.innerHTML = '<span class="fluent-icon"></span>';
        page.startSyncLoop();
    });

    audio.addEventListener('pause', () => {
        playBtn.innerHTML = '<span class="fluent-icon"></span>';
        page.stopSyncLoop();
    });

    // Update UI as music plays
    audio.addEventListener('timeupdate', () => {
        updatePlayerUI(audio.currentTime, audio.duration);
    });

    // Update Total Duration when file is loaded
    audio.addEventListener('loadedmetadata', () => {
        if (audio.duration && audio.duration !== Infinity) {
            if (timeTotal) timeTotal.innerText = formatPlayerTime(audio.duration);
            if (document.getElementById('sub-duration')) {
                document.getElementById('sub-duration').value = Math.floor(audio.duration);
            }
        }
    });

    // Scrubbing: Dragging the knob
    audioSlider.addEventListener('input', () => {
        const seekTime = (audioSlider.value / 100) * audio.duration;
        audio.currentTime = seekTime;
        // Immediate visual feedback for the bar color while dragging
        audioSlider.style.setProperty('--slider-fill', `${audioSlider.value}%`);
    });

    // Reset on end
    audio.addEventListener('ended', () => {
        audioSlider.value = 0;
        audioSlider.style.setProperty('--slider-fill', '0%');
        if (timeCurrent) timeCurrent.innerText = "0:00";
    });

    // Scrubbing: Clicking the progress bar track
    progressContainer.addEventListener('click', (e) => {
        const rect = progressContainer.getBoundingClientRect();
        const clickPos = (e.clientX - rect.left) / rect.width;
        audio.currentTime = clickPos * audio.duration;
    });
}

// ----------------------------------------------------
// LYRIC PARSERS
// ----------------------------------------------------
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
    if (isNaN(sec)) sec = 0;
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toFixed(3).padStart(6, '0');
    return `${m}:${s}`;
}

function formatTTMLTime(sec) {
    if (isNaN(sec)) sec = 0;
    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    const seconds = sec % 60;
    const secStr = seconds.toFixed(3).padStart(6, '0');
    if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${secStr}`;
    return `${minutes}:${secStr}`;
}

function parseTTML(xmlText) {
    if (!xmlText.includes("</tt>")) xmlText += "</div></body></tt>";
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");

    const agentMap = {};
    const agentNodes = xmlDoc.getElementsByTagName("ttm:agent");
    for (let node of agentNodes) {
        const id = node.getAttribute("xml:id");
        const nameNode = node.getElementsByTagName("ttm:name")[0];
        const name = nameNode ? nameNode.textContent : id;
        if (id) agentMap[id] = name;
    }
    window.agentMap = agentMap;

    const pTags = Array.from(xmlDoc.getElementsByTagName("p"));
    let parsed = [];

    pTags.forEach(p => {
        const start = parseTTMLTime(p.getAttribute("begin"));
        const end = parseTTMLTime(p.getAttribute("end"));
        const agent = p.getAttribute("ttm:agent") || "v1";
        let words = [];

        function traverse(node, isBg) {
            if (node.nodeName === 'span') {
                const nodeBg = isBg || node.getAttribute("ttm:role") === "x-bg";
                const hasChildSpans = Array.from(node.childNodes).some(n => n.nodeName === 'span');

                if (!hasChildSpans) {
                    const b = node.getAttribute("begin");
                    const e = node.getAttribute("end");
                    const text = node.textContent;
                    if (text.trim() !== '') {
                        words.push({ start: parseTTMLTime(b) || start, end: parseTTMLTime(e) || null, text: text, isBg: nodeBg });
                    }
                } else {
                    node.childNodes.forEach(child => traverse(child, nodeBg));
                }
            } else if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent;
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
        parsed.push({ start, end: end || (words.length ? words[words.length - 1].start + 2 : start + 5), agent, text: lineText || p.textContent.trim().replace(/\s+/g, ' '), words });
    });
    return parsed;
}

function parseEnhancedLRC(rawText) {
    const lines = rawText.split('\n');
    let parsed = [];

    lines.forEach(line => {
        if (line.match(/^\[[a-zA-Z]+:/) && !line.match(/^\[(v\d+|[A-Za-z0-9_]+):/)) return;
        const matchLine = line.match(/^\[(\d{2}:\d{2}\.\d{2,3})\](?:([A-Za-z0-9_]+):)?(.*)/);

        if (matchLine) {
            const startTime = parseTimestamp(matchLine[1]);
            const agent = matchLine[2] || "v1";
            let content = matchLine[3].replace(/\[bg:(.*?)\]/g, '($1)');
            const words = [];
            let currentChunk = "", isBg = false;

            for (let i = 0; i < content.length; i++) {
                if (content[i] === '(') {
                    if (currentChunk) parseChunk(currentChunk, false, words, startTime);
                    currentChunk = ""; isBg = true;
                } else if (content[i] === ')') {
                    if (currentChunk) parseChunk(currentChunk, true, words, startTime);
                    currentChunk = ""; isBg = false;
                } else {
                    currentChunk += content[i];
                }
            }
            if (currentChunk) parseChunk(currentChunk, isBg, words, startTime);

            const plainText = content.replace(/<[^>]+>/g, '').replace(/[\(\)]/g, '').trim();
            const validWords = [];
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
        if (parsed[i].words.length > 0) {
            const lastWord = parsed[i].words[parsed[i].words.length - 1];
            e = lastWord.end || (lastWord.start + 1.5);
        }
        if (parsed[i + 1]) e = Math.min(e, parsed[i + 1].start);
        parsed[i].end = e;
    }
    return parsed;
}

function parseChunk(text, isBg, wordsArr, lineStart) {
    const tagRegex = /<(\d{2}:\d{2}\.\d{2,3})>([^<]*)/g;
    let match, foundAny = false;
    while ((match = tagRegex.exec(text)) !== null) {
        foundAny = true;
        wordsArr.push({ start: parseTimestamp(match[1]), text: match[2], isBg });
    }
    if (!foundAny && text.trim()) wordsArr.push({ start: lineStart, text: text, isBg });
}

function renderPreview(containerId = 'sync-preview-content') {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    if (!window.parsedLines || window.parsedLines.length === 0) {
        container.innerHTML = `<div class="empty-state">Invalid format or empty lyrics</div>`;
        return;
    }

    // Human-readable names for the UI
    const agentNames = {
        'v1': 'Lead',
        'v2': 'Vocal 2',
        'v3': 'Vocal 3',
        'default': ''
    };

    window.parsedLines.forEach((line, i) => {
        const div = document.createElement('div');
        div.className = 'lyric-line';
        if (line.agent && line.agent !== 'v1') div.classList.add(`agent-${line.agent}`);
        if (window.enableLyricEffects) div.classList.add('with-effects');
        div.id = `line-${i}`;



        if (line.words && line.words.length > 0) {
            const mainContainer = document.createElement('div');
            const bgContainer = document.createElement('div');
            bgContainer.className = 'bg-vocals-container';

            line.words.forEach((w, wi) => {
                const span = document.createElement('span');
                span.className = 'lyric-word';
                if (w.isBg) span.classList.add('bg-vocal');
                if (window.enableLyricEffects) span.classList.add('with-effects');
                span.id = `word-${i}-${wi}`;
                span.innerText = w.text;
                span.setAttribute('data-text', w.text);
                w.isBg ? bgContainer.appendChild(span) : mainContainer.appendChild(span);
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
        document.getElementById('sync-preview-content').innerHTML = `<div class="empty-state">Lyrics will animate here</div>`;
        return;
    }
    const isTTML = text.trim().startsWith('<?xml') || text.trim().startsWith('<tt');

    if (!isTTML && !hasWarnedELRC) {
        showToast("We highly recommend using TTML Format instead of LRC/ELRC for precise accuracy.", "info");
        hasWarnedELRC = true;
    }

    if (!window.agentMap) window.agentMap = {};

    if (isTTML) {
        window.parsedLines = parseTTML(text);
    } else {
        window.parsedLines = parseEnhancedLRC(text);
        window.agentMap = { 'v1': 'Lead' };
    }

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

function convertLyrics(target) {
    const rawText = document.getElementById('sub-lyrics').value;
    if (!rawText.trim()) return showToast("Please paste or upload lyrics first.", "error");

    const isCurrentTTML = rawText.trim().startsWith('<?xml') || rawText.trim().startsWith('<tt');
    window.parsedLines = isCurrentTTML ? parseTTML(rawText) : parseEnhancedLRC(rawText);

    if (!window.parsedLines.length) return showToast("Could not extract valid lyric timings.", "error");

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
                    const wordEnd = word.end ? word.end : (line.words[i + 1] ? line.words[i + 1].start : line.end);
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
    } else {
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
                    elrcStr += `<${formatELRCTime(w.start)}>${w.text}${w.end ? `<${formatELRCTime(w.end)}>` : ''}`;
                });
                if (insideBg) elrcStr += "]";
            } else {
                elrcStr += line.text;
            }
            elrcStr += "\n";
        });
        document.getElementById('sub-lyrics').value = elrcStr.trim();
    }
    updateSyncPreview();
    showToast(`Converted to ${target.toUpperCase()} Format!`, "success");
}

window.fixLyricsFormatting = function () {
    const rawText = document.getElementById('sub-lyrics').value;
    if (!rawText.trim()) return showToast("Please paste or upload lyrics first.", "error");

    const isTTML = rawText.trim().startsWith('<?xml') || rawText.trim().startsWith('<tt');
    window.parsedLines = isTTML ? parseTTML(rawText) : parseEnhancedLRC(rawText);

    let fixedCount = 0;
    window.parsedLines.forEach(line => {
        if (line.words && line.words.length > 0) {
            for (let i = 0; i < line.words.length; i++) {
                let w = line.words[i];
                w.text = w.text.trim();
                if (i < line.words.length - 1) w.text += ' ';
            }
            const newText = line.words.map(w => w.text).join('');
            if (line.text !== newText.trim()) { fixedCount++; line.text = newText.trim(); }
        }
    });

    if (fixedCount > 0) {
        convertLyrics(isTTML ? 'ttml' : 'elrc'); // Re-generate format
        showToast(`Formatting fixed! Adjusted spacing on ${fixedCount} lines.`, "success");
    } else { showToast("Formatting is already perfect!", "info"); }
}

async function submitLyricsForm() {
    const vid = document.getElementById('sub-vid').value.trim();
    const song = document.getElementById('sub-song').value.trim();
    const artist = document.getElementById('sub-artist').value.trim();
    const durStr = document.getElementById('sub-duration').value.trim();
    const lyrics = document.getElementById('sub-lyrics').value.trim();
    const btn = document.getElementById('submit-btn');

    if (!vid && page.activeSource === 'yt') return showToast("Please provide a valid YouTube URL.", "error");
    if (!song || !artist || !durStr || !lyrics) return showToast("Please fill in all required fields.", "error");

    const isTTML = lyrics.startsWith('<?xml') || lyrics.startsWith('<tt');
    const format = isTTML ? 'ttml' : 'lrc';
    const syncType = isTTML ? 'richsync' : 'linesync';

    btn.disabled = true;
    btn.innerHTML = '<span class="fluent-icon spinner"></span> Publishing...';

    try {
        const payload = {
            videoId: vid || "local-file",
            song,
            artist,
            lyrics,
            format,
            duration: parseInt(durStr, 10),
            language: window.selectedLanguage || 'en',
            syncType: syncType
        };

        await apiSignedAction('/submit', payload);

        showToast("Successfully published!", "success");
        setTimeout(() => window.location.href = 'index.html', 1500);

    } catch (e) {
        showToast(e.message, "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="fluent-icon"></span> Publish to Unison';
    }
}


window.toggleRawPayload = function () {
    const body = document.getElementById('raw-payload-body');
    const icon = document.getElementById('raw-toggle-icon');

    body.classList.toggle('hidden');

    icon.classList.toggle('is-expanded');
    icon.classList.toggle('is-collapsed');
}

function copyRawLyrics() {
    const rawText = document.getElementById('det-raw').innerText;
    if (!rawText) return showToast("Nothing to copy!", "error");
    navigator.clipboard.writeText(rawText).then(() => showToast("Raw lyrics copied to clipboard!", "info"));
}

function downloadLyrics() {
    if (!window.currentLyricData) return;
    const { lyrics, song, artist, format } = window.currentLyricData;
    const ext = format === 'ttml' ? 'ttml' : (format === 'lrc' ? 'lrc' : 'txt');
    const filename = `${artist || 'Unknown'} - ${song || 'Unknown'}.${ext}`.replace(/[\\\\/:*?"<>|]/g, '');
    const blob = new Blob([lyrics], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
}

async function submitVote(voteValue) {
    if (!window.currentLyricId) return;
    try {
        await apiSignedAction(`/${window.currentLyricId}/vote`, { vote: voteValue });
        showToast("Your vote has been recorded!", "success");
        // Update Score (Mock)
    } catch (err) { showToast(`Vote failed: ${err.message}`, "error"); }
}

async function submitReport() {
    const dialog = document.getElementById('report-dialog');
    dialog.close();
    showToast("Report submitted successfully.", "success");
}

window.openFeedbackHub = function () { document.getElementById('feedback-dialog').showModal(); };
window.submitFeedback = function () {
    const input = document.getElementById('feedback-input');
    if (!input.value.trim()) return showToast('Please enter some feedback first.', 'error');
    input.value = '';
    document.getElementById('feedback-dialog').close();
    showToast('Feedback sent!', 'success');
};

function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        localStorage.setItem('unisonAvatar', e.target.result);
        const preview = document.getElementById('acc-avatar-preview');
        if (preview) preview.src = e.target.result;
        showToast("Avatar updated successfully!", "success");
    };
    reader.readAsDataURL(file);
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

        list.innerHTML = users.map((u, index) => {
            const delay = index * 0.05;

            const isDefaultUser = u.key_id === DEFAULT_IDENTITY.keyId;
            const imgSrc = isDefaultUser
                ? 'https://better-lyrics.boidu.dev/icons/logo.svg'
                : u.avatar_data || 'user.png';

            return `
            <div class="user-card animate-fade-up" style="animation-delay: ${delay}s;">
                <div class="user-avatar">
                    <img src="${imgSrc}" alt="${u.username}">
                </div>
                <div class="user-info">
                    <div class="user-name">${u.username || 'Anonymous'}</div>
                    <div class="user-status">
                        <div class="status-dot"></div> Active
                    </div>
                </div>
            </div>
            `;
        }).join('');

    } catch (err) {
        list.innerHTML = `<div class="empty-state text-muted" style="min-height: 100px; color: var(--danger);">Failed to load community members.</div>`;
    }
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
                avatarData: avatarData || null
            })
        });
    } catch (e) {
        console.warn("Could not log user presence", e);
    }
}


window.unison_external_submit = async function (payload) {
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

window.addEventListener('storage', async (event) => {

    if (event.key === 'unison_external_payload_trigger') {
        console.log("Unison: External payload detected via Storage Event.");

        try {
            const payload = JSON.parse(event.newValue);
            const { identity, youtubeUrl } = payload;

            if (identity) {
                if (identity.keyId && identity.privateKey) {
                    localStorage.setItem('unisonIdentity', JSON.stringify(identity));
                    console.log("Unison: Identity injected successfully.");
                }
            }
            if (document.body.id !== 'page-submit') {
                window.location.href = 'submit.html';
                return;
            }

            if (youtubeUrl) {
                const urlInput = document.getElementById('sub-url-input');
                if (urlInput) urlInput.value = youtubeUrl;


                if (typeof page !== 'undefined' && page.parseYoutubeUrl) {
                    page.parseYoutubeUrl(youtubeUrl);
                }

                showToast("Data received from extension!", "success");
            }

            localStorage.removeItem('unison_external_payload_trigger');

        } catch (err) {
            console.error("Unison External Error:", err);
            showToast("Failed to import extension data: " + err.message, "error");
        }
    }
});

async function checkExternalTrigger() {
    const trigger = localStorage.getItem('unison_external_payload_trigger');
    if (trigger) {
        console.log("Unison: Found pending external payload on load.");
        window.dispatchEvent(new StorageEvent('storage', {
            key: 'unison_external_payload_trigger',
            newValue: trigger
        }));
    }
}

function initCustomSelects() {
    const selects = document.querySelectorAll('.wui-list-select select');
    selects.forEach(select => {
        const wrapper = document.createElement('div');
        wrapper.className = 'fluent-select-wrapper';

        const trigger = document.createElement('div');
        trigger.className = 'fluent-select-trigger';
        const selectedOpt = select.options[select.selectedIndex];
        trigger.innerHTML = `<span class="fluent-select-text">${selectedOpt ? selectedOpt.text : 'Select...'}</span><span class="fluent-icon"></span>`;

        const dropdown = document.createElement('div');
        dropdown.className = 'fluent-select-dropdown hidden';

        Array.from(select.options).forEach(opt => {
            const item = document.createElement('div');
            item.className = 'fluent-select-item' + (opt.selected ? ' selected' : '');
            item.innerText = opt.text;
            item.dataset.value = opt.value;
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                select.value = opt.value;
                select.dispatchEvent(new Event('change'));
                trigger.querySelector('.fluent-select-text').innerText = opt.text;
                dropdown.querySelectorAll('.fluent-select-item').forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
                dropdown.classList.add('hidden');

                if (select.id === 'language-select') window.selectedLanguage = opt.value;
            });
            dropdown.appendChild(item);
        });

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.fluent-select-dropdown').forEach(d => {
                if (d !== dropdown) d.classList.add('hidden');
            });
            dropdown.classList.toggle('hidden');
            if (!dropdown.classList.contains('hidden')) {
                const selectedItem = dropdown.querySelector('.selected');
                if (selectedItem) selectedItem.scrollIntoView({ block: 'nearest' });
            }
        });

        wrapper.appendChild(trigger);
        wrapper.appendChild(dropdown);

        select.style.display = 'none'; // Hide native select
        select.parentNode.insertBefore(wrapper, select.nextSibling);
    });

    document.addEventListener('click', () => {
        document.querySelectorAll('.fluent-select-dropdown').forEach(d => d.classList.add('hidden'));
    });
}
checkExternalTrigger();