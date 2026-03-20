/**
 * Canonicalizes a JSON object to match Python's strict signing requirements.
 */
export function canonicalJson(obj) {
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

/**
 * Converts an ArrayBuffer to a Base64 string.
 */
export function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

/**
 * Signs a payload using the WebCrypto API with ECDSA P-256
 */
export async function signPayload(privateKeyJwk, payloadObj) {
    // 1. Import Key
    const key = await window.crypto.subtle.importKey(
        "jwk",
        privateKeyJwk,
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["sign"]
    );

    // 2. Canonicalize & Encode
    const payloadStr = canonicalJson(payloadObj);
    const encoder = new TextEncoder();
    const data = encoder.encode(payloadStr);

    // 3. Sign (Outputs 64 bytes raw r|s)
    const signatureBuffer = await window.crypto.subtle.sign(
        { name: "ECDSA", hash: { name: "SHA-256" } },
        key,
        data
    );

    // 4. Base64 Encode
    return arrayBufferToBase64(signatureBuffer);
}