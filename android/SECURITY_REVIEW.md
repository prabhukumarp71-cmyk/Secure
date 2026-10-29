# Cybersecurity Threat Model & Security Review

## 1. Threat Model & Adversary Capabilities

### Adversary A: Physical Possession of USB Drive
- **Capability**: Attacker acquires the USB stick and attempts to view files on a PC, Mac, Linux, or another phone.
- **Mitigation**: All files are stored as `.svault` with raw AES-256-GCM ciphertext. Renaming `.svault` to `.jpg` or `.mp4` fails in all image decoders because there are no valid JPEG/PNG/MP4 headers.
- **Strength**: 256-bit key space brute force resistance; 100k PBKDF2 iterations enforce substantial computational cost per attempt.

### Adversary B: Rogue Application with Media Permissions
- **Capability**: A malicious or ad-supported app on the phone requests `READ_MEDIA_IMAGES` or scans public directories.
- **Mitigation**: Decrypted images and videos are held *exclusively in volatile RAM* or rendered via ephemeral in-memory streams. Decrypted files are never indexed into Android's `MediaStore` or saved to public caches.

### Adversary C: Shoulder Surfer / Screen Smudge Reconstruction
- **Capability**: An observer watches over the user's shoulder or uses latent screen oil marks to deduce the PIN pattern.
- **Mitigation**: Moto Secure's **Scramble Keypad** randomizes the positions of numeric digits 0-9 on each display, rendering smudge-based deduction and visual angle tracking ineffective.

### Adversary D: Screen Recording & Background App Switcher Spies
- **Capability**: Background malware attempts to take periodic display screenshots, or the phone is viewed in Android's recent apps switcher.
- **Mitigation**: The app enforces `WindowManager.LayoutParams.FLAG_SECURE`. Android's compositor blacks out any screen captures and renders a blank card in the recents switcher.

## 2. Platform Realities & Limitations
1. **Source Photo Cleanup**: When photos are imported from the device's public camera roll, the user must explicitly confirm deleting the unencrypted original in the Google Photos / Gallery app. The vault app cannot silently delete files across external storage without user consent.
2. **Loss of Recovery Key**: There is no corporate backdoor or master key. If a user loses both their PIN and their 12-word emergency recovery phrase, the data is mathematically unrecoverable.
3. **Hardware Keystore vs USB Portability**: Because files on the USB drive must be portable across devices (e.g. unlocking on a tablet or second phone with the same PIN), file keys are derived deterministically via PBKDF2 with embedded salts rather than hardware Keystore keys tied exclusively to a single phone's secure element.
