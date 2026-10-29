# Moto Secure USB Photo Vault for Android

A production-grade Android application inspired by Motorola Moto Secure, designed to securely encrypt and store photos and videos directly onto USB OTG pen drives with zero unencrypted traces.

## Key Security Features
- **AES-256-GCM Authenticated Encryption**: Every file contains a 128-bit authentication tag ensuring any bit tampering or corruption is immediately detected.
- **PBKDF2 Key Derivation**: Uses 100,000 iterations of HMAC-SHA256 with a unique 32-byte salt per file.
- **Zero-Knowledge PIN**: The PIN is never saved in plaintext on disk.
- **Scramble Keypad**: Reorders digits randomly to prevent shoulder surfing and screen smudge analysis.
- **FLAG_SECURE**: Prevents Android screenshots, screen recording, and exposure in recent apps.
- **Storage Access Framework**: Operates through Android's official document provider without requesting broad system storage privileges.

## Building the Project in Android Studio
1. Open Android Studio (Hedgehog 2023.1.1 or newer).
2. Select **File > Open** and choose this `android` project directory.
3. Allow Gradle to synchronize dependencies.
4. Connect an Android device running Android 10 (API 29) or newer with USB Debugging enabled.
5. Click **Run 'app'** (Shift + F10).

## Running Automated Security Tests
Run unit tests in the command line or via Android Studio:
```bash
./gradlew test
```
