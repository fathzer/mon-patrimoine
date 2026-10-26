/**
 * PKCE (RFC 7636) helpers shared by the OAuth redirect providers
 * (Dropbox, Microsoft OneDrive...).
 */
/** Generates a high-entropy code verifier. */
export function generateVerifier() {
    return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}
/** Computes the S256 code challenge of a verifier. */
export async function pkceChallenge(verifier) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    return base64Url(new Uint8Array(digest));
}
function base64Url(bytes) {
    let binary = '';
    for (const b of bytes)
        binary += String.fromCharCode(b);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
//# sourceMappingURL=pkce.js.map