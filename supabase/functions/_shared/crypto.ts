/**
 * AES-256-GCM encryption & decryption for sensitive tokens.
 * Uses Web Crypto API (supported natively in Deno and modern JS runtimes).
 */

async function getEncryptionKey(): Promise<CryptoKey> {
  const secret =
    Deno.env.get("DRIVE_ENCRYPTION_KEY") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    "face-attendance-drive-secret-fallback-key-32b";

  const enc = new TextEncoder();
  const rawKey = enc.encode(secret);
  const hash = await crypto.subtle.digest("SHA-256", rawKey);

  return await crypto.subtle.importKey(
    "raw",
    hash,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptToken(plainText: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const encoded = enc.encode(plainText);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );

  const ivB64 = btoa(String.fromCharCode(...iv));
  const ctB64 = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));

  return `${ivB64}:${ctB64}`;
}

export async function decryptToken(encryptedString: string): Promise<string> {
  const [ivB64, ctB64] = encryptedString.split(":");
  if (!ivB64 || !ctB64) {
    throw new Error("Invalid encrypted token format");
  }

  const key = await getEncryptionKey();
  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
  const ct = Uint8Array.from(atob(ctB64), (c) => c.charCodeAt(0));

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ct
  );

  return new TextDecoder().decode(decrypted);
}
