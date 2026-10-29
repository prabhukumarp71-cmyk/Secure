package com.motosecure.usbvault.crypto

import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Binary specification for Moto Secure .svault encrypted container.
 * Format Version 1.0 (AES-256-GCM Authenticated Encryption)
 *
 * Header Layout:
 * [0..7]   : Magic "SVAULT01" (8 bytes)
 * [8..11]  : Format Version (uint32)
 * [12..43] : PBKDF2 Salt (32 bytes)
 * [44..55] : Metadata IV (12 bytes)
 * [56..59] : Encrypted Metadata Length N (uint32)
 * [60..60+N-1] : Metadata Ciphertext
 * [..+16]  : Metadata GCM Auth Tag (16 bytes)
 * [..+12]  : Media IV (12 bytes)
 * [..+8]   : Media Ciphertext Length M (uint64)
 * [..+M]   : Media Ciphertext
 * [..+16]  : Media GCM Auth Tag (16 bytes)
 */
object SvaultFileFormat {
    val MAGIC = "SVAULT01".toByteArray(Charsets.US_ASCII)
    const val CURRENT_VERSION = 1
    const val SALT_LENGTH = 32
    const val IV_LENGTH = 12
    const val AUTH_TAG_LENGTH = 16

    data class ParsedHeader(
        val version: Int,
        val salt: ByteArray,
        val metadataIv: ByteArray,
        val encryptedMetadata: ByteArray,
        val mediaIv: ByteArray,
        val mediaCiphertextOffset: Long,
        val mediaCiphertextLength: Long
    )

    fun parseHeader(headerBuffer: ByteBuffer): ParsedHeader {
        headerBuffer.order(ByteOrder.BIG_ENDIAN)

        // 1. Verify Magic
        val magic = ByteArray(8)
        headerBuffer.get(magic)
        if (!magic.contentEquals(MAGIC)) {
            throw IllegalArgumentException("Not a valid .svault file: Magic header mismatch")
        }

        // 2. Version
        val version = headerBuffer.int
        if (version != CURRENT_VERSION) {
            throw IllegalArgumentException("Unsupported .svault format version: $version")
        }

        // 3. Salt
        val salt = ByteArray(SALT_LENGTH)
        headerBuffer.get(salt)

        // 4. Metadata IV
        val metadataIv = ByteArray(IV_LENGTH)
        headerBuffer.get(metadataIv)

        // 5. Metadata Length
        val metaLen = headerBuffer.int
        val encryptedMetadataWithTag = ByteArray(metaLen + AUTH_TAG_LENGTH)
        headerBuffer.get(encryptedMetadataWithTag)

        // 6. Media IV
        val mediaIv = ByteArray(IV_LENGTH)
        headerBuffer.get(mediaIv)

        // 7. Media Length
        val mediaLen = headerBuffer.long
        val mediaOffset = headerBuffer.position().toLong()

        return ParsedHeader(
            version = version,
            salt = salt,
            metadataIv = metadataIv,
            encryptedMetadata = encryptedMetadataWithTag,
            mediaIv = mediaIv,
            mediaCiphertextOffset = mediaOffset,
            mediaCiphertextLength = mediaLen
        )
    }
}
