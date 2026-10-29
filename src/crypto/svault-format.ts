/**
 * Secure USB Photo Vault - .svault Binary File Format Specification
 * Version 1.0 (AES-256-GCM Authenticated Encryption)
 *
 * File Structure:
 * [0..7]   : Magic Bytes ASCII "SVAULT01" (8 bytes)
 * [8..11]  : Format Version uint32 Big-Endian (0x00000001)
 * [12..43] : PBKDF2 Salt (32 bytes cryptographically secure random)
 * [44..55] : Metadata GCM IV / Nonce (12 bytes)
 * [56..59] : Encrypted Metadata Length uint32 Big-Endian (N bytes)
 * [60..60+N-1] : Encrypted Metadata Ciphertext
 * [60+N..60+N+15] : Metadata GCM Authentication Tag (16 bytes)
 * [..+12]  : Media Payload GCM IV / Nonce (12 bytes)
 * [..+8]   : Media Payload Length uint64 Big-Endian (M bytes)
 * [..+M]   : Media Payload Ciphertext
 * [..+16]  : Media Payload GCM Authentication Tag (16 bytes)
 */

export const SVAULT_MAGIC = new Uint8Array([0x53, 0x56, 0x41, 0x55, 0x4c, 0x54, 0x30, 0x31]); // "SVAULT01"
export const CURRENT_FORMAT_VERSION = 1;
export const SALT_LENGTH = 32;
export const IV_LENGTH = 12;
export const AUTH_TAG_LENGTH = 16;
export const PBKDF2_ITERATIONS = 100_000;

export interface VaultFileMetadata {
  id: string;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  width?: number;
  height?: number;
  durationSeconds?: number;
  importedAt: number;
  checksumSha256: string;
  vaultVersion: number;
}

export interface PackedSvaultData {
  magic: Uint8Array;
  version: number;
  salt: Uint8Array;
  metadataIv: Uint8Array;
  metadataCiphertext: Uint8Array;
  metadataTag: Uint8Array;
  mediaIv: Uint8Array;
  mediaCiphertext: Uint8Array;
  mediaTag: Uint8Array;
}

/**
 * Serializes components into a single .svault binary Uint8Array
 */
export function serializeSvault(
  salt: Uint8Array,
  metadataIv: Uint8Array,
  encryptedMetadataWithTag: Uint8Array, // WebCrypto AES-GCM appends 16-byte tag at the end
  mediaIv: Uint8Array,
  encryptedMediaWithTag: Uint8Array
): Uint8Array {
  // WebCrypto AES-GCM returns ciphertext + 16-byte tag concatenated
  const metaTotal = encryptedMetadataWithTag.length;
  const metaCipherLen = metaTotal - AUTH_TAG_LENGTH;
  const metaCipher = encryptedMetadataWithTag.subarray(0, metaCipherLen);
  const metaTag = encryptedMetadataWithTag.subarray(metaCipherLen);

  const mediaTotal = encryptedMediaWithTag.length;
  const mediaCipherLen = mediaTotal - AUTH_TAG_LENGTH;
  const mediaCipher = encryptedMediaWithTag.subarray(0, mediaCipherLen);
  const mediaTag = encryptedMediaWithTag.subarray(mediaCipherLen);

  // Total buffer length
  const totalLength =
    8 + // magic
    4 + // version
    SALT_LENGTH + // salt (32)
    IV_LENGTH + // metadata IV (12)
    4 + // metadata length (4)
    metaCipherLen + // metadata ciphertext
    AUTH_TAG_LENGTH + // metadata tag (16)
    IV_LENGTH + // media IV (12)
    8 + // media length (8)
    mediaCipherLen + // media ciphertext
    AUTH_TAG_LENGTH; // media tag (16)

  const buffer = new Uint8Array(totalLength);
  const view = new DataView(buffer.buffer);
  let offset = 0;

  // 1. Magic
  buffer.set(SVAULT_MAGIC, offset);
  offset += 8;

  // 2. Version
  view.setUint32(offset, CURRENT_FORMAT_VERSION, false);
  offset += 4;

  // 3. Salt
  buffer.set(salt, offset);
  offset += SALT_LENGTH;

  // 4. Metadata IV
  buffer.set(metadataIv, offset);
  offset += IV_LENGTH;

  // 5. Metadata Length
  view.setUint32(offset, metaCipherLen, false);
  offset += 4;

  // 6. Metadata Ciphertext
  buffer.set(metaCipher, offset);
  offset += metaCipherLen;

  // 7. Metadata Tag
  buffer.set(metaTag, offset);
  offset += AUTH_TAG_LENGTH;

  // 8. Media IV
  buffer.set(mediaIv, offset);
  offset += IV_LENGTH;

  // 9. Media Length (uint64 as two uint32)
  const high = Math.floor(mediaCipherLen / 0x100000000);
  const low = mediaCipherLen >>> 0;
  view.setUint32(offset, high, false);
  view.setUint32(offset + 4, low, false);
  offset += 8;

  // 10. Media Ciphertext
  buffer.set(mediaCipher, offset);
  offset += mediaCipherLen;

  // 11. Media Tag
  buffer.set(mediaTag, offset);
  offset += AUTH_TAG_LENGTH;

  return buffer;
}

/**
 * Parses raw .svault binary Uint8Array into discrete components
 */
export function deserializeSvault(buffer: Uint8Array): {
  salt: Uint8Array;
  metadataIv: Uint8Array;
  metadataCipherWithTag: Uint8Array;
  mediaIv: Uint8Array;
  mediaCipherWithTag: Uint8Array;
  version: number;
} {
  if (buffer.length < 8 + 4 + SALT_LENGTH + IV_LENGTH + 4 + AUTH_TAG_LENGTH + IV_LENGTH + 8 + AUTH_TAG_LENGTH) {
    throw new Error('Invalid file: buffer is smaller than minimum .svault header size (84 bytes)');
  }

  // 1. Check Magic
  for (let i = 0; i < 8; i++) {
    if (buffer[i] !== SVAULT_MAGIC[i]) {
      throw new Error('Invalid file format: Missing SVAULT01 magic identifier. This is not a valid .svault file.');
    }
  }

  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let offset = 8;

  // 2. Version
  const version = view.getUint32(offset, false);
  offset += 4;
  if (version !== CURRENT_FORMAT_VERSION) {
    throw new Error(`Unsupported vault format version: ${version} (expected ${CURRENT_FORMAT_VERSION})`);
  }

  // 3. Salt
  const salt = buffer.subarray(offset, offset + SALT_LENGTH);
  offset += SALT_LENGTH;

  // 4. Metadata IV
  const metadataIv = buffer.subarray(offset, offset + IV_LENGTH);
  offset += IV_LENGTH;

  // 5. Metadata Length
  const metaCipherLen = view.getUint32(offset, false);
  offset += 4;

  if (offset + metaCipherLen + AUTH_TAG_LENGTH > buffer.length) {
    throw new Error('Corrupted .svault file: metadata length exceeds buffer size');
  }

  // 6. Metadata Ciphertext
  const metaCipher = buffer.subarray(offset, offset + metaCipherLen);
  offset += metaCipherLen;

  // 7. Metadata Tag
  const metaTag = buffer.subarray(offset, offset + AUTH_TAG_LENGTH);
  offset += AUTH_TAG_LENGTH;

  // Combine back into WebCrypto GCM format (cipher + tag)
  const metadataCipherWithTag = new Uint8Array(metaCipherLen + AUTH_TAG_LENGTH);
  metadataCipherWithTag.set(metaCipher, 0);
  metadataCipherWithTag.set(metaTag, metaCipherLen);

  // 8. Media IV
  const mediaIv = buffer.subarray(offset, offset + IV_LENGTH);
  offset += IV_LENGTH;

  // 9. Media Length
  const high = view.getUint32(offset, false);
  const low = view.getUint32(offset + 4, false);
  const mediaCipherLen = high * 0x100000000 + low;
  offset += 8;

  if (offset + mediaCipherLen + AUTH_TAG_LENGTH > buffer.length) {
    throw new Error('Corrupted .svault file: media length exceeds buffer size');
  }

  // 10. Media Ciphertext
  const mediaCipher = buffer.subarray(offset, offset + mediaCipherLen);
  offset += mediaCipherLen;

  // 11. Media Tag
  const mediaTag = buffer.subarray(offset, offset + AUTH_TAG_LENGTH);
  offset += AUTH_TAG_LENGTH;

  // Combine back into WebCrypto GCM format
  const mediaCipherWithTag = new Uint8Array(mediaCipherLen + AUTH_TAG_LENGTH);
  mediaCipherWithTag.set(mediaCipher, 0);
  mediaCipherWithTag.set(mediaTag, mediaCipherLen);

  return {
    salt,
    metadataIv,
    metadataCipherWithTag,
    mediaIv,
    mediaCipherWithTag,
    version,
  };
}

/**
 * Utility to convert byte array to formatted hex string
 */
export function bytesToHex(bytes: Uint8Array, separator = ' '): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0').toUpperCase())
    .join(separator);
}
