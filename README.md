<p align="center">
  <img src="https://github.com/user-attachments/assets/af0e6446-946c-477e-830e-0143152b229b" alt="Unison Web Banner" width="100%" />
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
  <img src="https://img.shields.io/badge/version-v1.1-blueviolet?style=for-the-badge" alt="Version" />
  <img src="https://img.shields.io/badge/Made%20with-❤️-red?style=for-the-badge" alt="Made with Heart" />
  <img src="https://img.shields.io/badge/Location-Sri%20Lanka-orange?style=for-the-badge" alt="Location" />
</p>

---

## 🚀 What's New in v1.1

We have completely overhauled the experience to focus on **precision** and **workflow efficiency**.

- **Brand New UI:** A sleek, modern, and distraction-free interface.
- **Intelligent Conversion:** Effortlessly transform **ELRC** (word-synced) lyrics into standard **LRC** (line-synced) or professional **TTML** formats.
- **Deep Discovery:** Advanced search functionality to find any song in the database instantly.
- **Portable Lyrics:** One-click download function to save your synced lyrics locally.
- **Quality Control:** Integrated Upvote/Downvote and Reporting systems to maintain database integrity.
- **Live Sync Preview:** Real-time lyric visualization in both the **Submission** and **Detail** views.

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
/**
 * Injected via chrome.scripting.executeScript
 * @param {Object} payload - The data to be processed by Unison
 */
window.unison_external_submit({
    identity: { 
        "version": 1,
        "keyId": "03917810b1b144867dccad8df5c6ae9633e0dfee799c7d4b0840891624a939c3",
        "publicKey": { ... },
        "privateKey": { ... },
        "displayName": "Sarah"
    },
    youtubeUrl: "https://www.youtube.com/watch?v=KXMU5rWxtvU"
});
```

---

## 🛠 Technical Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | Vanilla JavaScript (ES6+), HTML5, CSS3 (Custom Properties) |
| **Security** | Web Crypto API (ECDSA P-256) for secure, client-side signing |
| **Deployment** | Vercel |
| **Design** | Google Material Symbols |

<p align="center">
  Made with ❤️ by <a href="https://github.com/yourusername">Walker 🇱🇰</a>
</p>
