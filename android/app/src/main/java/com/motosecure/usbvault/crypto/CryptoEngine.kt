package com.motosecure.usbvault.crypto

import java.io.InputStream
import java.io.OutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.SecretKey
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

/**
 * Enterprise Cryptographic Engine for USB OTG Photo Vault.
 * Implements AES-256-GCM Authenticated Encryption with PBKDF2 Key Derivation.
 */
class CryptoEngine {

    companion object {
        private const val ALGORITHM = "AES"
        private const val CIPHER_TRANSFORMATION = "AES/GCM/NoPadding"
        private const val KEY_DERIVATION_ALGO = "PBKDF2WithHmacSHA256"
        private const val PBKDF2_ITERATIONS = 100_000
        private const val KEY_SIZE_BITS = 256
        private const val GCM_TAG_LENGTH_BITS = 128
        private const val IV_SIZE_BYTES = 12
        private const val SALT_SIZE_BYTES = 32

        private val secureRandom = SecureRandom()
    }

    /**
     * Derives a 256-bit AES key from user PIN and random salt using PBKDF2.
     */
    fun deriveKey(pinOrPassphrase: CharArray, salt: ByteArray): SecretKey {
        val spec = PBEKeySpec(pinOrPassphrase, salt, PBKDF2_ITERATIONS, KEY_SIZE_BITS)
        val factory = SecretKeyFactory.getInstance(KEY_DERIVATION_ALGO)
        val keyBytes = factory.generateSecret(spec).encoded
        spec.clearPassword() // Zero PIN characters immediately
        return SecretKeySpec(keyBytes, ALGORITHM)
    }

    /**
     * Encrypts an input stream of media directly into the .svault output stream on the USB drive.
     * Prevents keeping full multi-gigabyte video files in RAM.
     */
    fun encryptMediaStream(
        key: SecretKey,
        salt: ByteArray,
        metadataJson: String,
        mediaInput: InputStream,
        mediaLength: Long,
        usbOutput: OutputStream,
        onProgress: (bytesWritten: Long, totalBytes: Long) -> Unit
    ) {
        // 1. Generate Nonces
        val metaIv = ByteArray(IV_SIZE_BYTES).also { secureRandom.nextBytes(it) }
        val mediaIv = ByteArray(IV_SIZE_BYTES).also { secureRandom.nextBytes(it) }

        // 2. Encrypt Metadata
        val metaCipher = Cipher.getInstance(CIPHER_TRANSFORMATION)
        metaCipher.init(Cipher.ENCRYPT_MODE, key, GCMParameterSpec(GCM_TAG_LENGTH_BITS, metaIv))
        val metaBytes = metadataJson.toByteArray(Charsets.UTF_8)
        val encryptedMeta = metaCipher.doFinal(metaBytes)

        // 3. Write .svault Header
        val headerBuffer = ByteBuffer.allocate(8 + 4 + SALT_SIZE_BYTES + IV_SIZE_BYTES + 4)
        headerBuffer.order(ByteOrder.BIG_ENDIAN)
        headerBuffer.put(SvaultFileFormat.MAGIC)
        headerBuffer.putInt(SvaultFileFormat.CURRENT_VERSION)
        headerBuffer.put(salt)
        headerBuffer.put(metaIv)
        headerBuffer.putInt(encryptedMeta.size - 16) // Length without tag

        usbOutput.write(headerBuffer.array())
        usbOutput.write(encryptedMeta) // Ciphertext + 16-byte auth tag

        // 4. Write Media IV and Length
        val mediaHeader = ByteBuffer.allocate(IV_SIZE_BYTES + 8)
        mediaHeader.order(ByteOrder.BIG_ENDIAN)
        mediaHeader.put(mediaIv)
        mediaHeader.putLong(mediaLength)
        usbOutput.write(mediaHeader.array())

        // 5. Encrypt Media Payload in Streaming Chunks
        val mediaCipher = Cipher.getInstance(CIPHER_TRANSFORMATION)
        mediaCipher.init(Cipher.ENCRYPT_MODE, key, GCMParameterSpec(GCM_TAG_LENGTH_BITS, mediaIv))

        val buffer = ByteArray(64 * 1024) // 64 KB buffer
        var bytesRead: Int
        var totalWritten = 0L

        while (mediaInput.read(buffer).also { bytesRead = it } != -1) {
            val chunk = mediaCipher.update(buffer, 0, bytesRead)
            if (chunk != null && chunk.isNotEmpty()) {
                usbOutput.write(chunk)
                totalWritten += chunk.size
            }
            onProgress(totalWritten, mediaLength)
        }

        // Finalize GCM and write authentication tag
        val finalBlock = mediaCipher.doFinal()
        if (finalBlock != null && finalBlock.isNotEmpty()) {
            usbOutput.write(finalBlock)
            totalWritten += finalBlock.size
        }
        usbOutput.flush()
    }

    /**
     * Decrypts .svault media directly into an in-memory byte buffer for safe rendering.
     * Throws SecurityException if the GCM auth tag fails (detects tampered bits).
     */
    fun decryptMediaToMemory(
        key: SecretKey,
        mediaIv: ByteArray,
        encryptedMediaStream: InputStream,
        ciphertextLength: Long
    ): ByteArray {
        val cipher = Cipher.getInstance(CIPHER_TRANSFORMATION)
        cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(GCM_TAG_LENGTH_BITS, mediaIv))

        val ciphertext = ByteArray(ciphertextLength.toInt())
        var offset = 0
        while (offset < ciphertext.size) {
            val count = encryptedMediaStream.read(ciphertext, offset, ciphertext.size - offset)
            if (count == -1) break
            offset += count
        }

        return cipher.doFinal(ciphertext)
    }

    /**
     * Overwrites a sensitive byte array with zeros in memory.
     */
    fun zeroMemory(buffer: ByteArray) {
        buffer.fill(0)
    }
}
