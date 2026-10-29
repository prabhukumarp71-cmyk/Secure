# Contributing to Moto Secure USB Vault

Thank you for your interest in improving Moto Secure USB Vault!

## Code of Conduct
We expect contributors to maintain a respectful, constructive, and inclusive environment.

## Development Workflow

### Kotlin & Android App
- All Android code resides in `/android`.
- Target language: Kotlin 2.0+ with Jetpack Compose Material 3.
- All cryptographic operations must use authenticated encryption (AES-256-GCM) with unique nonces and verified authentication tags.
- Run tests locally before opening a pull request:
  ```bash
  cd android
  ./gradlew test
  ./gradlew lint
  ```

### Web Companion & Security Test Bench
- Located in `/src`.
- TypeScript with strict typing.
- Run type checks and build:
  ```bash
  npm run lint
  npm run build
  ```

## Pull Request Guidelines
1. Fork the repository and create your branch from `main`.
2. Ensure all tests pass.
3. If introducing changes to the `.svault` binary format, update the version number and migration tests.
4. Keep pull requests focused and document any changes to the threat model.
