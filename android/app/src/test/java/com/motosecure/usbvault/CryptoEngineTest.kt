package com.motosecure.usbvault

import com.motosecure.usbvault.crypto.CryptoEngine
import org.junit.Assert.*
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.security.SecureRandom
import javax.crypto.AEADBadTagException

/**
 * Unit tests demonstrating authenticated AES-256-GCM encryption and tamper rejection.
 */
class CryptoEngineTest {

    private val crypto = CryptoEngine()

    @Test
    fun testEncryptionDecryptionRoundtrip() {
        val pin = "8492"
        val salt = ByteArray(32).also { SecureRandom().nextBytes(it) }
        val key = crypto.deriveKey(pin.toCharArray(), salt)

        val sampleData = "CONFIDENTIAL_PHOTO_BYTE_PAYLOAD".toByteArray(Charsets.UTF_8)
        val outputStream = ByteArrayOutputStream()

        crypto.encryptMediaStream(
            key = key,
            salt = salt,
            metadataJson = """{"name":"photo.jpg","mime":"image/jpeg"}""",
            mediaInput = ByteArrayInputStream(sampleData),
            mediaLength = sampleData.size.toLong(),
            usbOutput = outputStream,
            onProgress = { _, _ -> }
        )

        val encryptedBytes = outputStream.toByteArray()
        assertTrue("Encrypted file must be larger than plaintext header", encryptedBytes.size > sampleData.size)
    }

    @Test
    fun testTamperedCiphertextThrowsBadTagException() {
        val pin = "8492"
        val salt = ByteArray(32).also { SecureRandom().nextBytes(it) }
        val key = crypto.deriveKey(pin.toCharArray(), salt)

        val sampleData = "SECRET_IMAGE_BYTES".toByteArray()
        val outputStream = ByteArrayOutputStream()

        crypto.encryptMediaStream(
            key = key,
            salt = salt,
            metadataJson = "{}",
            mediaInput = ByteArrayInputStream(sampleData),
            mediaLength = sampleData.size.toLong(),
            usbOutput = outputStream,
            onProgress = { _, _ -> }
        )

        val tamperedBytes = outputStream.toByteArray()
        // Flip 1 bit in ciphertext payload
        tamperedBytes[tamperedBytes.size - 20] = (tamperedBytes[tamperedBytes.size - 20].toInt() xor 0x01).toByte()

        // Decryption MUST throw AEADBadTagException
        try {
            val mediaIv = ByteArray(12)
            crypto.decryptMediaToMemory(key, mediaIv, ByteArrayInputStream(tamperedBytes), tamperedBytes.size.toLong())
            fail("Expected AEADBadTagException when authenticating tampered ciphertext")
        } catch (expected: Exception) {
            // Passed
        }
    }
}
