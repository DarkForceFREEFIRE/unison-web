<p align="center">
  <img src="https://github.com/user-attachments/assets/2a4acb6c-99bb-400f-9742-fa7beb987ce2" alt="Unison Web Banner" width="100%" />
</p>

<p align="center">
  <a href="https://blrcunison.vercel.app">
    <strong>Explore Unison Web →</strong>
  </a>
</p>

<p align="center">
  <strong>Unison Web</strong> is a high-performance, professional interface designed to publish and manage synchronized lyrics for the <code>Better Lyrics API</code>. 
  <br />
  <em>Built on top of the <a href="https://unison.boidu.dev/">Unison Core API</a>.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-v1.3-blueviolet?style=for-the-badge" alt="Version" />
  <img src="https://img.shields.io/badge/Made%20with-❤️-red?style=for-the-badge" alt="Made with Heart" />
  <img src="https://img.shields.io/badge/Location-Sri%20Lanka-orange?style=for-the-badge" alt="Location" />
</p>

---

## 🚀 What's New in v1.3

We have completely overhauled the experience to focus on **precision** and **workflow efficiency**.

- **Brand New UI:** A modern, WinUI3 inspired interface.
- **Bug fixes:** Between the **ELRC** and **TTML** conversion is accurate and supports standrad formats.
- **Improved player:** The player now supports Karoke style lyrics and smooth scrollings. Also, the player shows the vocal agent at the YT preview pane.

---

## 🧪 The Extension Workflow (Developer Integration)

Unison is engineered to be "Extension-First." We provide a seamless bridge between YouTube and the Unison Database, eliminating manual data entry.

### 👤 The User Experience
1. **Discover:** Find any song on YouTube.
2. **Bridge:** Click the **Unison Extension** icon.
3. **Automated Sync:** The extension injects the user's Identity, fetches YouTube metadata (Title/Artist), and redirects them to the Submit page—**ready to publish in seconds.**

### 🛠 For Extension Developers
To implement this "Magic Redirect," your extension's content script must call the globally exposed `unison_external_submit` function on the Unison domain.

**Implementation Example:**
```javascript
async function uploadToUnison(youtubeUrl) {
    // Get user credentials from your extension's storage/auth
    const userCredentials = {
        keyId: "user_...",
        privateKey: {
            crv: "P-256",
            d: "9ZDC9...",
            ext: true,
            key_ops: ["sign"],
            kty: "EC",
            x: "R4zIdpk_...",
            y: "5pPq3zB..."
        },
        publicKey: {
            crv: "P-256",
            ext: true,
            key_ops: ["verify"],
            kty: "EC",
            x: "R4zIdpk_...",
            y: "5pPq3zBl..."
        },
        displayName: "Sarah"
    };
    
    // Call the unison exported function
    const unisonTab = await chrome.tabs.create({ 
        url: "(https://blrcunison.vercel.app/submit.html" 
    });
    
    // Wait for page to load, then inject
    chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === unisonTab.id && info.status === 'complete') {
            chrome.scripting.executeScript({
                target: { tabId: unisonTab.id },
                func: (identity, url) => {
                    window.unison_external_submit({
                        identity: identity,
                        youtubeUrl: url
                    });
                },
                args: [userCredentials, youtubeUrl]
            });
            chrome.tabs.onUpdated.removeListener(listener);
        }
    });
}
```

---

## 🛠 Technical Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | Vanilla JavaScript (ES6+), HTML5, CSS3 (Custom Properties) |
| **Security** | Web Crypto API (ECDSA P-256) for secure, client-side signing |
| **Deployment** | Vercel |
| **Design** | Microsoft WinUI3 Fluent |

<p align="center">
  Made with ❤️ by <a href="https://github.com/https://github.com/DarkForceFREEFIRE">Walker 🇱🇰</a>
</p>
