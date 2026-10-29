# Security Policy

## Supported Versions

| Version | Supported          | Cryptographic Engine |
| ------- | ------------------ | -------------------- |
| 1.0.x   | :white_check_mark: | AES-256-GCM (128-bit MAC) |
| < 1.0   | :x:                | None                 |

## Reporting a Vulnerability

We take the security and cryptographic integrity of Moto Secure USB Vault seriously.

If you believe you have discovered a vulnerability related to:
- Key derivation or PBKDF2 salt weakness
- GCM nonce/IV reuse
- Plaintext leakage in Android storage, cache, or MediaStore
- Bypass of `FLAG_SECURE` window protections
- Storage Access Framework access escalation

**Please do NOT file a public issue on GitHub.**

Instead, please report the vulnerability privately via GitHub's Security Advisories feature or email our maintainers.

Please include:
1. Steps to reproduce the issue.
2. A proof-of-concept script or `.svault` file sample.
3. Android OS version and device architecture.
4. Expected vs. observed cryptographic behavior.

We will acknowledge receipt within 48 hours and work on a remediation before any coordinated disclosure.
