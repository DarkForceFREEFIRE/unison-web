# Unison Web
A web-based interface to publish lyrics to Better Lyrics API
https://blrcunison.vercel.app

Based on ```https://unison.boidu.dev/``` API

Made with ❤️ by Walker 🇱🇰

**v1.1 Updated**
- Brand new UI
- Convert ELRC word-synced lyrics to LRC line-synced lyrics
- Convert ELRC format to TTML format
- Upvote/Downvote and Report functions
- Search function
- lyrics download function
- View synced lyrics in both submit and detail page


<img width="4374" height="2483" alt="BR" src="https://github.com/user-attachments/assets/af0e6446-946c-477e-830e-0143152b229b" />



## 🔌 The Extension Workflow (Magic Integration)

The core power of Unison comes from its ability to bridge the gap between YouTube and the Unison Database. 

### How it works for the user:
1. **Find a song** on YouTube.
2. **Click the Unison Extension** icon.
3. **Instant Sync:** The extension automatically logs the user in (using their stored Identity), pulls the YouTube metadata (Song/Artist), and redirects them to the Unison Submit page with everything pre-filled.

### For Extension Developers
To implement this, your extension (or whaterver tool you use) content script must call the globally exposed `unison_external_submit` function on the Unison domain.

**Payload Structure:**
```javascript
// This function should be called via chrome.scripting.executeScript
window.unison_external_submit({
    identity: { 
        /* Full Unison Identity JSON */ 
        "keyId": "...",
        "privateKey": { ... },
        "publicKey": { ... },
        "displayName": "..."
    },
    youtubeUrl: "https://www.youtube.com/watch?v=VIDEO_ID"
});
```
_____________________________________________________________________________

**🛠 Technical Stack**

Frontend: Vanilla JavaScript (ES6+), HTML5, CSS3 (Custom Properties/Variables)
Cryptography: Web Crypto API (ECDSA P-256) for secure signing
Deployment: Vercel
Icons: Google Material Symbols
