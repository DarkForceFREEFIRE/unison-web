import { API_BASE_URL } from './config.js';
import { signPayload } from './crypto.js';

/**
 * Publishes lyrics to the Unison server.
 */
export async function publishToUnison(payload, identity) {
    const signature = await signPayload(identity.privateKey, payload);

    const envelope = {
        payload: payload,
        signature: signature,
        publicKey: identity.publicKey
    };

    const response = await fetch(`${API_BASE_URL}/submit`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-key-id": identity.keyId
        },
        body: JSON.stringify(envelope)
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Error ${response.status}: ${errText}`);
    }

    return response;
}

/**
 * Fetches the user's previously submitted lyrics.
 */
export async function fetchUserLyrics(keyId) {
    const response = await fetch(`${API_BASE_URL}/mine?limit=50`, {
        headers: { "x-key-id": keyId }
    });

    if (!response.ok) {
        throw new Error("Failed to fetch lyrics from server.");
    }

    return response.json();
}