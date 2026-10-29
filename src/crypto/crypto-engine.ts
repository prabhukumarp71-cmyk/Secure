/**
 * Secure Cryptographic Engine
 * Implements AES-256-GCM Authenticated Encryption with PBKDF2 Key Derivation
 * Conforms to NIST SP 800-38D and Android Keystore security requirements.
 */

import {
  serializeSvault,
  deserializeSvault,
  VaultFileMetadata,
  SALT_LENGTH,
  IV_LENGTH,
  PBKDF2_ITERATIONS,
  CURRENT_FORMAT_VERSION,
} from './svault-format';

export class IntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IntegrityError';
  }
}

/**
 * Securely overwrites a Uint8Array in memory with zeros
 */
export function zeroBuffer(buf: Uint8Array): void {
  buf.fill(0);
}

/**
 * Derives a 256-bit CryptoKey from a user PIN or passphrase and unique salt
 * Uses PBKDF2 with HMAC-SHA256 and 100,000 iterations.
 */
export async function deriveKey(secret: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const secretBytes = encoder.encode(secret);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false, // non-extractable in memory
    ['encrypt', 'decrypt']
  );

  return derivedKey;
}

/**
 * Computes SHA-256 hash of a buffer (returned as hex string)
 */
export async function computeSha256(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data as unknown as BufferSource);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Encrypts raw media buffer and metadata into a complete .svault file
 */
export async function encryptMediaToSvault(
  pinOrPassphrase: string,
  rawMediaBytes: Uint8Array,
  metadataPartial: {
    id: string;
    originalFileName: string;
    mimeType: string;
    width?: number;
    height?: number;
    durationSeconds?: number;
  }
): Promise<{
  svaultBytes: Uint8Array;
  metadata: VaultFileMetadata;
  encryptionTimeMs: number;
}> {
  const startTime = performance.now();

  // 1. Generate unique 32-byte salt
  const salt = new Uint8Array(SALT_LENGTH);
  crypto.getRandomValues(salt);

  // 2. Derive AES-256 key
  const aesKey = await deriveKey(pinOrPassphrase, salt);

  // 3. Generate independent 12-byte nonces for metadata and media
  const metadataIv = new Uint8Array(IV_LENGTH);
  const mediaIv = new Uint8Array(IV_LENGTH);
  crypto.getRandomValues(metadataIv);
  crypto.getRandomValues(mediaIv);

  // 4. Compute original media SHA-256 for integrity record
  const checksumSha256 = await computeSha256(rawMediaBytes);

  // 5. Build full metadata object
  const metadata: VaultFileMetadata = {
    ...metadataPartial,
    fileSizeBytes: rawMediaBytes.byteLength,
    importedAt: Date.now(),
    checksumSha256,
    vaultVersion: CURRENT_FORMAT_VERSION,
  };

  // 6. Encrypt metadata with AES-256-GCM
  const metaEncoder = new TextEncoder();
  const metaPlainBytes = metaEncoder.encode(JSON.stringify(metadata));
  const encryptedMetadataBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: metadataIv as unknown as BufferSource,
      tagLength: 128, // 16 bytes
    },
    aesKey,
    metaPlainBytes
  );

  // 7. Encrypt media payload with AES-256-GCM
  const encryptedMediaBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: mediaIv as unknown as BufferSource,
      tagLength: 128, // 16 bytes
    },
    aesKey,
    rawMediaBytes as unknown as BufferSource
  );

  // 8. Package into .svault binary structure
  const svaultBytes = serializeSvault(
    salt,
    metadataIv,
    new Uint8Array(encryptedMetadataBuffer),
    mediaIv,
    new Uint8Array(encryptedMediaBuffer)
  );

  const encryptionTimeMs = Math.round(performance.now() - startTime);

  return {
    svaultBytes,
    metadata,
    encryptionTimeMs,
  };
}

/**
 * Decrypts a .svault file using the provided PIN or Passphrase
 * Throws IntegrityError or DecryptionError if key is wrong or data was tampered with
 */
export async function decryptSvault(
  pinOrPassphrase: string,
  svaultBytes: Uint8Array
): Promise<{
  metadata: VaultFileMetadata;
  decryptedMediaBytes: Uint8Array;
  decryptionTimeMs: number;
}> {
  const startTime = performance.now();

  // 1. Unpack header and components
  const { salt, metadataIv, metadataCipherWithTag, mediaIv, mediaCipherWithTag } =
    deserializeSvault(svaultBytes);

  // 2. Derive key using the embedded salt
  const aesKey = await deriveKey(pinOrPassphrase, salt);

  // 3. Decrypt and authenticate metadata
  let decryptedMetaBuffer: ArrayBuffer;
  try {
    decryptedMetaBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: metadataIv as unknown as BufferSource,
        tagLength: 128,
      },
      aesKey,
      metadataCipherWithTag as unknown as BufferSource
    );
  } catch (err) {
    throw new IntegrityError(
      'Authentication Failed: Invalid PIN or the .svault header was tampered with (AES-GCM Tag Mismatch)'
    );
  }

  const metaDecoder = new TextDecoder();
  const metadata: VaultFileMetadata = JSON.parse(metaDecoder.decode(decryptedMetaBuffer));

  // 4. Decrypt and authenticate media payload
  let decryptedMediaBuffer: ArrayBuffer;
  try {
    decryptedMediaBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: mediaIv as unknown as BufferSource,
        tagLength: 128,
      },
      aesKey,
      mediaCipherWithTag as unknown as BufferSource
    );
  } catch (err) {
    throw new IntegrityError(
      'Ciphertext Integrity Error: Media payload bytes were modified, truncated, or corrupted on the USB drive.'
    );
  }

  const decryptedMediaBytes = new Uint8Array(decryptedMediaBuffer);

  // 5. Verify SHA-256 against recorded checksum
  const verifiedChecksum = await computeSha256(decryptedMediaBytes);
  if (verifiedChecksum !== metadata.checksumSha256) {
    throw new IntegrityError(
      'Integrity Check Failed: Decrypted file hash does not match original stored SHA-256 digest'
    );
  }

  const decryptionTimeMs = Math.round(performance.now() - startTime);

  return {
    metadata,
    decryptedMediaBytes,
    decryptionTimeMs,
  };
}

/**
 * Decrypts only the metadata header from a .svault file (for fast gallery indexing without decrypting gigabytes of video)
 */
export async function decryptSvaultMetadataOnly(
  pinOrPassphrase: string,
  svaultBytes: Uint8Array
): Promise<VaultFileMetadata> {
  const { salt, metadataIv, metadataCipherWithTag } = deserializeSvault(svaultBytes);
  const aesKey = await deriveKey(pinOrPassphrase, salt);

  try {
    const decryptedMetaBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: metadataIv as unknown as BufferSource,
        tagLength: 128,
      },
      aesKey,
      metadataCipherWithTag as unknown as BufferSource
    );
    const metaDecoder = new TextDecoder();
    return JSON.parse(metaDecoder.decode(decryptedMetaBuffer));
  } catch {
    throw new IntegrityError('Authentication Failed: Invalid PIN');
  }
}

/**
 * Creates a deliberately tampered copy of a .svault file for security testing
 * Flips 1 bit in the ciphertext or tag to demonstrate AES-GCM rejection
 */
export function createTamperedSvault(
  originalBytes: Uint8Array,
  tamperTarget: 'header' | 'metadata_ciphertext' | 'media_ciphertext' | 'media_tag'
): Uint8Array {
  const copy = new Uint8Array(originalBytes);
  if (tamperTarget === 'header') {
    // Corrupt magic byte
    copy[0] = 0x00;
  } else if (tamperTarget === 'metadata_ciphertext') {
    // Flip bit in metadata area (around byte 70)
    if (copy.length > 70) copy[70] ^= 0x01;
  } else if (tamperTarget === 'media_ciphertext') {
    // Flip bit in the middle of media ciphertext
    const mid = Math.floor(copy.length / 2);
    copy[mid] ^= 0xff;
  } else if (tamperTarget === 'media_tag') {
    // Flip bit in the last 16 bytes (the media auth tag)
    copy[copy.length - 2] ^= 0x55;
  }
  return copy;
}
