/**
 * Crypto service: PIN hashing (PBKDF2) + WebAuthn Passkeys
 * 100% client-side, no backend required
 */

// ─── PIN Hashing (PBKDF2) ───────────────────────────────────────────

const PBKDF2_ITERATIONS = 100_000
const SALT_LENGTH = 16
const HASH_LENGTH = 32

function bufferToBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
}

function base64ToBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

export async function hashPin(
  pin: string,
  existingSalt?: string
): Promise<{ hash: string; salt: string }> {
  const encoder = new TextEncoder()
  const saltBuffer = existingSalt
    ? new Uint8Array(base64ToBuffer(existingSalt))
    : crypto.getRandomValues(new Uint8Array(SALT_LENGTH))

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    'PBKDF2',
    false,
    ['deriveBits']
  )

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    HASH_LENGTH * 8
  )

  return {
    hash: bufferToBase64(derivedBits),
    salt: existingSalt || bufferToBase64(saltBuffer.buffer),
  }
}

export async function verifyPin(
  pin: string,
  storedHash: string,
  salt: string
): Promise<boolean> {
  const { hash } = await hashPin(pin, salt)
  return hash === storedHash
}

// ─── WebAuthn Passkeys ──────────────────────────────────────────────

const RP_NAME = 'SWU Companion'

/** Check if the browser supports WebAuthn + platform authenticator (biometrics) */
export function isPasskeyAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.PublicKeyCredential &&
    typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
  )
}

/** Async check — confirms hardware biometric is actually present */
export async function isPasskeyReady(): Promise<boolean> {
  if (!isPasskeyAvailable()) return false
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

/** Register a new passkey for a user profile */
export async function createPasskey(
  userId: string,
  userName: string
): Promise<{ credentialId: string; publicKey: string }> {
  const challenge = crypto.getRandomValues(new Uint8Array(32))
  const userIdBuffer = new TextEncoder().encode(userId)

  const credential = (await navigator.credentials.create({
    publicKey: {
      rp: {
        name: RP_NAME,
        id: window.location.hostname,
      },
      user: {
        id: userIdBuffer,
        name: userName,
        displayName: userName,
      },
      challenge,
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },   // ES256
        { alg: -257, type: 'public-key' },  // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // built-in biometric
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60_000,
      attestation: 'none', // no server verification needed
    },
  })) as PublicKeyCredential | null

  if (!credential) throw new Error('No se pudo crear la passkey')

  const response = credential.response as AuthenticatorAttestationResponse
  return {
    credentialId: bufferToBase64(credential.rawId),
    publicKey: bufferToBase64(response.getPublicKey?.() || new ArrayBuffer(0)),
  }
}

/** Authenticate with a specific passkey (when we know which profile) */
export async function authenticateWithPasskey(
  credentialId: string
): Promise<boolean> {
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32))
    const credential = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [
          {
            id: base64ToBuffer(credentialId),
            type: 'public-key',
            transports: ['internal'],
          },
        ],
        userVerification: 'required',
        timeout: 60_000,
      },
    })
    return !!credential
  } catch {
    return false
  }
}

/** Authenticate with any registered passkey (discoverable — browser shows picker) */
export async function authenticateWithAnyPasskey(): Promise<string | null> {
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32))
    const credential = (await navigator.credentials.get({
      publicKey: {
        challenge,
        userVerification: 'required',
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null

    if (!credential) return null
    return bufferToBase64(credential.rawId)
  } catch {
    return null
  }
}
