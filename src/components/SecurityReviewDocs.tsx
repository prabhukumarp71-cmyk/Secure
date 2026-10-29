import React from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Lock,
  EyeOff,
  Cpu,
  HardDrive,
  FileLock2,
  Trash2,
  KeyRound,
  FileCheck2,
} from 'lucide-react';

export const SecurityReviewDocs: React.FC = () => {
  return (
    <div className="space-y-6 max-w-5xl">
      {/* HEADER */}
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-indigo-500" />
          <span>Cybersecurity Review, Threat Model & Limitation Analysis</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Comprehensive analysis of cryptographic guarantees, attack surface boundaries, and operational recovery realities.
        </p>
      </div>

      {/* CORE PRINCIPLE CALLOUT */}
      <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 rounded-2xl flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
        <div className="text-xs text-indigo-950 dark:text-indigo-200 leading-relaxed">
          <strong>Non-Negotiable Security Principle:</strong> Moto Secure USB Vault encrypts the raw byte stream of every photo and video using <strong>AES-256-GCM</strong> authenticated encryption. We strictly reject security-by-obscurity techniques such as prepending dot prefixes to filenames, renaming extensions to <code className="font-mono text-indigo-400">.dat</code>, or using XOR masking. If a <code className="font-mono text-indigo-400">.svault</code> file is inspected or renamed on any other operating system, it yields only unreadable pseudo-random bytes.
        </div>
      </div>

      {/* SECTION 1: THREAT MODEL */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs flex items-center gap-2">
          <FileLock2 className="w-4 h-4 text-slate-400" />
          <span>1. Threat Model & Adversary Profiles</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
            <div className="text-xs font-bold text-slate-900 dark:text-white">
              Adversary A: Physical USB Drive Possession
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              <strong>Scenario:</strong> The USB pen drive is lost, stolen, or connected to an unauthorized PC, Mac, or forensic workstation.
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              <strong>Defense:</strong> All payloads are protected by AES-256-GCM with a 128-bit authentication tag. Without the derivation secret (user PIN + PBKDF2 100k salt), brute-forcing a 256-bit key space is computationally infeasible. File metadata (original name, dimensions, camera EXIF, timestamps) is also encrypted within the authenticated header.
            </p>
          </div>

          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
            <div className="text-xs font-bold text-slate-900 dark:text-white">
              Adversary B: Rogue Application with Media Permissions
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              <strong>Scenario:</strong> A malicious or ad-supported app on the phone requests <code className="font-mono text-indigo-400">READ_MEDIA_IMAGES</code> or scans public directories.
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              <strong>Defense:</strong> Decrypted images and videos are held <em>exclusively in volatile RAM</em> or rendered via ephemeral in-memory streams. Decrypted files are never indexed into Android's <code className="font-mono text-indigo-400">MediaStore</code> or saved to public caches.
            </p>
          </div>

          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
            <div className="text-xs font-bold text-slate-900 dark:text-white">
              Adversary C: Shoulder Surfer / Screen Smudge Reconstruction
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              <strong>Scenario:</strong> An observer watches over the user's shoulder or uses latent screen oil marks to deduce the PIN pattern.
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              <strong>Defense:</strong> Moto Secure's <strong>Scramble Keypad</strong> randomizes the positions of numeric digits 0-9 on each display, rendering smudge-based deduction and visual angle tracking ineffective.
            </p>
          </div>

          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
            <div className="text-xs font-bold text-slate-900 dark:text-white">
              Adversary D: Screen Recording & Background App Switcher Spies
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              <strong>Scenario:</strong> Background malware attempts to take periodic display screenshots, or the phone is viewed in Android's recent apps switcher.
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              <strong>Defense:</strong> The app enforces <code className="font-mono text-indigo-400">WindowManager.LayoutParams.FLAG_SECURE</code>. Android's compositor blacks out any screen captures and renders a blank card in the recents switcher.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 2: CRITICAL LIMITATIONS & USER RESPONSIBILITY */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <span>2. Critical Security Boundaries & Operational Warnings</span>
        </h3>

        <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-2xl space-y-3">
          <div className="flex items-start gap-2.5">
            <Trash2 className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-700 dark:text-amber-200/90 leading-relaxed">
              <strong>Original Unencrypted Photos on Phone:</strong> When a user imports photos from their camera roll into the vault, an encrypted copy is written to the USB drive. <em>However, the unencrypted original on the phone's internal storage remains present until the user explicitly deletes it.</em> Android's security sandbox prevents apps from silently deleting user photos without explicit system confirmation dialogs.
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <KeyRound className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-700 dark:text-amber-200/90 leading-relaxed">
              <strong>Permanent Unrecoverability (Zero-Knowledge Tradeoff):</strong> There is no back-door, developer master key, or server-side reset. If the user forgets their PIN and has not safely archived their 12-word offline recovery phrase, their encrypted media is mathematically lost forever.
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Cpu className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-700 dark:text-amber-200/90 leading-relaxed">
              <strong>Compromised Operating System / Root Exploits:</strong> If the host Android operating system is compromised by root access, kernel exploits, or malicious accessibility services, memory buffers could theoretically be read while the media is being actively rendered on screen.
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: RECOVERY ARCHITECTURE */}
      <section className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
        <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
          <FileCheck2 className="w-4 h-4 text-emerald-500" />
          <span>3. Recovery Architecture vs. Hardware Keystore Portability</span>
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          A critical architectural question in USB OTG security is: <em>Why not lock the encryption key exclusively into the phone's Android Keystore hardware element?</em>
        </p>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          If files were encrypted using a key sealed exclusively within Phone A's Keystore, the USB pen drive would become completely unusable on Phone B, a tablet, or a replacement device if Phone A were dropped or stolen.
          To ensure true USB drive portability while maintaining high security, we use PBKDF2 with 100,000 iterations of HMAC-SHA256 and unique 32-byte salts per file, combined with a 12-word BIP-39 mnemonic recovery phrase. This provides high cryptographic resistance to offline GPU dictionary attacks while allowing portable cross-device decryption.
        </p>
      </section>
    </div>
  );
};
