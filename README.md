# Moto Secure USB Photo Vault for Android

[![Android CI](https://github.com/motosecure/usb-vault/actions/workflows/android-ci.yml/badge.svg)](https://github.com/motosecure/usb-vault/actions/workflows/android-ci.yml)
[![Web CI](https://github.com/motosecure/usb-vault/actions/workflows/web-ci.yml/badge.svg)](https://github.com/motosecure/usb-vault/actions/workflows/web-ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Android](https://img.shields.io/badge/Android-10%2B%20(API%2029%2B)-green.svg)](https://developer.android.com)
[![Cryptography](https://img.shields.io/badge/Encryption-AES--256--GCM-red.svg)](https://csrc.nist.gov/publications/detail/sp/800-38d/final)

A production-grade, zero-knowledge Android application inspired by **Motorola Moto Secure**, engineered to encrypt photos and videos with authenticated **AES-256-GCM** before writing them directly to a connected **USB OTG pen drive**.

Files stored on the USB drive use the custom `.svault` binary format. They **cannot** be viewed as normal photos or videos in Google Photos, Gallery, file managers, or on a PC/Mac without explicit PIN authentication and authenticated decryption.

---

## Key Features

### 1. Military-Grade Authenticated Encryption
- **AES-256-GCM (Galois/Counter Mode)**: Protects confidentiality and authenticity. Every file embeds a 128-bit authentication tag; if even a single bit in the ciphertext is modified or corrupted, decryption fails immediately.
- **PBKDF2 Key Derivation**: 100,000 iterations of HMAC-SHA256 with unique 32-byte salts per file to thwart offline GPU dictionary attacks.
- **Zero-Knowledge PIN**: The user's PIN is never saved in plaintext in storage or SQLite.
- **Emergency 12-Word Recovery Phrase**: Cryptographically derived BIP-39 mnemonic seed phrase allows offline recovery if the PIN is forgotten.

### 2. USB OTG & Storage Access Framework (SAF)
- **Automatic USB OTG Detection**: Detects USB flash drives connected via OTG adapters using `android.hardware.usb.action.USB_DEVICE_ATTACHED`.
- **Scoped Document Trees**: Leverages Android's Storage Access Framework (`DocumentFile`) without requesting dangerous broad storage permissions.
- **Zero Plaintext Footprint on USB**: Media is encrypted in-stream directly to the USB drive; unencrypted temporary copies are never written to the thumb drive.
- **Safely Eject Handling**: Monitors USB mount/unmount states and cleanly flushes disk buffers before physical disconnect.

### 3. Moto Secure Defensive UI
- **Scramble Keypad**: Randomizes the layout of numeric digits 0–9 on each display to prevent shoulder-surfing and fingerprint smudge reconstruction.
- **Brute-Force Throttling**: Exponential backoff with a 30-second lockout countdown after 3 incorrect attempts.
- **Android `FLAG_SECURE`**: Blocks screenshots, screen recorders, and blanks out window contents in Android's recent apps task switcher.
- **RAM-Only Decryption**: Media files are decrypted directly into volatile memory buffers (`ByteArray` / ephemeral streams) and zeroed out upon viewer exit. Decrypted files are never indexed by Android's `MediaStore`.

---

## `.svault` Binary File Format Specification (v1.0)

```text
+--------------------------------------------------------------------------+
| OFFSET | FIELD                       | LENGTH   | DESCRIPTION            |
|--------+-----------------------------+----------+------------------------|
| 0..7   | Magic Bytes                 | 8 bytes  | ASCII "SVAULT01"       |
| 8..11  | Format Version              | 4 bytes  | uint32 BE (0x00000001) |
| 12..43 | PBKDF2 Salt                 | 32 bytes | CSPRNG Random Salt     |
| 44..55 | Metadata Nonce / IV         | 12 bytes | GCM Initialization V.  |
| 56..59 | Metadata Ciphertext Length  | 4 bytes  | uint32 BE (N bytes)    |
| 60..   | Encrypted Metadata JSON     | N bytes  | Original name, EXIF... |
| ..+16  | Metadata GCM Auth Tag       | 16 bytes | 128-bit MAC Tag        |
| ..+12  | Media Nonce / IV            | 12 bytes | Independent GCM IV     |
| ..+8   | Media Ciphertext Length     | 8 bytes  | uint64 BE (M bytes)    |
| ..+M   | Media Ciphertext Payload    | M bytes  | Encrypted image/video  |
| ..+16  | Media GCM Auth Tag          | 16 bytes | 128-bit MAC Tag        |
+--------------------------------------------------------------------------+
```

---

## Repository Structure

```text
├── android/                             # Complete Android Studio project
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── AndroidManifest.xml      # USB OTG filters & permissions
│   │   │   ├── java/com/motosecure/usbvault/
│   │   │   │   ├── crypto/              # CryptoEngine, SvaultFormat
│   │   │   │   ├── storage/             # UsbStorageManager (SAF)
│   │   │   │   └── ui/                  # Compose UI & ViewModels
│   │   │   └── res/xml/device_filter.xml
│   │   ├── src/test/java/               # JUnit 5 Cryptographic Unit Tests
│   │   └── build.gradle.kts
│   ├── build.gradle.kts
│   ├── settings.gradle.kts
│   └── gradle.properties
├── src/                                 # Web Companion & Security Test Bench
│   ├── crypto/                          # WebCrypto AES-GCM engine & parser
│   ├── storage/                         # Virtual & Physical USB OTG manager
│   ├── components/                      # Moto Secure UI, Viewer, Test Bench
│   └── App.tsx
├── .github/
│   └── workflows/                       # Android & Web CI/CD workflows
├── LICENSE                              # Apache 2.0
├── SECURITY.md                          # Vulnerability reporting policy
└── CONTRIBUTING.md                      # Developer guidelines
```

---

## Getting Started

### Option A: Build Android Studio Project

#### Prerequisites
- **Android Studio** (Hedgehog 2023.1.1 or newer recommended)
- **JDK 17**
- Android device or emulator running **Android 10 (API 29)** or newer

#### Build & Run
1. Open Android Studio.
2. Choose **File > Open** and select the `/android` directory.
3. Wait for Gradle sync to complete.
4. Run unit and cryptographic tests:
   ```bash
   cd android
   ./gradlew test
   ```
5. Build the debug APK:
   ```bash
   ./gradlew assembleDebug
   ```
   The APK will be generated at `android/app/build/outputs/apk/debug/app-debug.apk`.

---

### Option B: Run the Web Companion & Security Test Bench

A high-fidelity web companion with an interactive cryptographic test bench and hex inspector is included.

#### Prerequisites
- **Node.js** 18+ or 20+
- **npm** 9+

#### Setup & Run
```bash
# 1. Install dependencies
npm install

# 2. Run local development server
npm run dev

# 3. Build production bundle
npm run build

# 4. Run TypeScript checks
npm run lint
```

---

## Running Security & Tamper Tests

The project includes an interactive test lab and unit tests verifying:
1. **Single-Bit Tamper Rejection**: Inverting 1 bit in `.svault` ciphertext causes `AEADBadTagException` / `IntegrityError`.
2. **Rename Spoofing Test**: Renaming `.svault` to `.jpg` or `.mp4` causes operating system image decoders to fail with unsupported header errors.
3. **Entropy & Salt Verification**: Encrypting identical plaintexts generates distinct, non-deterministic ciphertexts.

---

## Security Threat Model & Boundaries

- **Physical USB Theft**: An adversary obtaining the pen drive cannot decrypt media without the user's PIN.
- **Original Phone Photos**: Importing photos from the public camera roll writes an encrypted copy to the USB drive. *The user must separately delete the unencrypted original in Google Photos / Gallery*, as Android restricts background file deletion.
- **Zero Master Key**: No backdoors exist. If both the PIN and the 12-word recovery phrase are lost, data is mathematically unrecoverable.

---

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) for details.
