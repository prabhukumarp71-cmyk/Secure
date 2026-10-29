import React, { useState, useEffect } from 'react';
import {
  Shield,
  Usb,
  Lock,
  HardDrive,
  FolderLock,
  Layers,
  Sparkles,
  Smartphone,
  Bug,
  FileCheck2,
} from 'lucide-react';
import { Header } from './components/Header';
import { PinLockScreen } from './components/PinLockScreen';
import { VaultDashboard } from './components/VaultDashboard';
import { SecurityTestBench } from './components/SecurityTestBench';
import { AndroidProjectExplorer } from './components/AndroidProjectExplorer';
import { SecurityReviewDocs } from './components/SecurityReviewDocs';
import {
  UsbDriveInfo,
  EncryptedVaultEntry,
  DEFAULT_SIMULATED_DRIVE,
  vaultDb,
} from './storage/usb-manager';
import { generateRecoveryPhrase } from './crypto/recovery';
import {
  encryptMediaToSvault,
  decryptSvault,
  zeroBuffer,
} from './crypto/crypto-engine';
import { generateSampleCanvasImage } from './storage/sample-media';

export default function App() {
  const [isDark, setIsDark] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'gallery' | 'testbench' | 'android' | 'threat_model'>('gallery');

  // Vault Security States
  const [isConfigured, setIsConfigured] = useState<boolean>(false);
  const [isLocked, setIsLocked] = useState<boolean>(true);
  const [activePin, setActivePin] = useState<string>('');
  const [recoveryPhrase, setRecoveryPhrase] = useState<string[]>([]);

  // Storage and drive states
  const [driveInfo, setDriveInfo] = useState<UsbDriveInfo>(DEFAULT_SIMULATED_DRIVE);
  const [vaultFiles, setVaultFiles] = useState<EncryptedVaultEntry[]>([]);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  // Initialize vault and check existing setup
  useEffect(() => {
    async function init() {
      try {
        const savedPhrase = localStorage.getItem('svault_recovery_phrase');
        const configuredFlag = localStorage.getItem('svault_configured');

        if (savedPhrase && configuredFlag === 'true') {
          setIsConfigured(true);
          setRecoveryPhrase(JSON.parse(savedPhrase));
        } else {
          // Generate new 12-word BIP-39 recovery seed
          const phrase = generateRecoveryPhrase();
          setRecoveryPhrase(phrase);
          setIsConfigured(false);
        }

        // Load files from IndexedDB
        const storedFiles = await vaultDb.getAllFiles();
        if (storedFiles && storedFiles.length > 0) {
          setVaultFiles(storedFiles);
        } else {
          // Will pre-seed after first setup or unlock
        }
      } catch (err) {
        console.error('Initialization error:', err);
      } finally {
        setIsInitializing(false);
      }
    }

    init();
  }, []);

  // Pre-seed sample files upon first vault unlock if empty
  const preseedSampleFiles = async (pin: string) => {
    try {
      const existing = await vaultDb.getAllFiles();
      if (existing.length === 0) {
        // Generate and encrypt 2 sample photos directly
        const imgBytes1 = await generateSampleCanvasImage(
          'Yosemite Valley Mist',
          'Landscape Photography',
          '#0f172a',
          '#0284c7'
        );
        const imgBytes2 = await generateSampleCanvasImage(
          'Night Neon Cyber District',
          'Street Photography',
          '#1e1b4b',
          '#a855f7'
        );

        const enc1 = await encryptMediaToSvault(pin, imgBytes1, {
          id: 'init_sample_01',
          originalFileName: 'Yosemite_Mist_4K.jpg',
          mimeType: 'image/jpeg',
        });
        const enc2 = await encryptMediaToSvault(pin, imgBytes2, {
          id: 'init_sample_02',
          originalFileName: 'Neon_District_Street.jpg',
          mimeType: 'image/jpeg',
        });

        zeroBuffer(imgBytes1);
        zeroBuffer(imgBytes2);

        const entry1: EncryptedVaultEntry = {
          fileName: 'sv_yosemite.svault',
          metadata: enc1.metadata,
          rawSvaultBytes: enc1.svaultBytes,
          lastModified: Date.now(),
        };
        const entry2: EncryptedVaultEntry = {
          fileName: 'sv_neon.svault',
          metadata: enc2.metadata,
          rawSvaultBytes: enc2.svaultBytes,
          lastModified: Date.now(),
        };

        await vaultDb.saveFile(entry1);
        await vaultDb.saveFile(entry2);
        setVaultFiles([entry1, entry2]);
      }
    } catch (e) {
      console.warn('Preseeding sample files skipped:', e);
    }
  };

  // Handler for setup completion
  const handleSetupVault = async (pin: string, phrase: string[]) => {
    localStorage.setItem('svault_configured', 'true');
    localStorage.setItem('svault_recovery_phrase', JSON.stringify(phrase));
    // Store verification test block (AES-GCM encryption of a known token) to verify PIN without saving PIN plaintext
    const testPayload = new TextEncoder().encode('MOTO_SECURE_VAULT_TEST_VERIFIER');
    const { svaultBytes } = await encryptMediaToSvault(pin, testPayload, {
      id: 'verifier_token',
      originalFileName: 'verifier.dat',
      mimeType: 'application/octet-stream',
    });
    localStorage.setItem('svault_verifier_block', JSON.stringify(Array.from(svaultBytes)));

    setIsConfigured(true);
    setActivePin(pin);
    setIsLocked(false);
    await preseedSampleFiles(pin);
  };

  // Handler for unlocking with PIN
  const handleUnlock = async (pinToTest: string): Promise<boolean> => {
    try {
      const verifierBlockStr = localStorage.getItem('svault_verifier_block');
      if (verifierBlockStr) {
        const rawBytes = new Uint8Array(JSON.parse(verifierBlockStr));
        // Attempt decryption of verifier block
        await decryptSvault(pinToTest, rawBytes);
        setActivePin(pinToTest);
        setIsLocked(false);
        await preseedSampleFiles(pinToTest);
        return true;
      } else {
        // Fallback demo unlock
        setActivePin(pinToTest);
        setIsLocked(false);
        await preseedSampleFiles(pinToTest);
        return true;
      }
    } catch (err) {
      return false;
    }
  };

  // Handler for recovery phrase unlock
  const handleRecoveryUnlock = async (phrase: string[], newPin: string): Promise<boolean> => {
    const saved = localStorage.getItem('svault_recovery_phrase');
    if (!saved) return false;
    const originalPhrase: string[] = JSON.parse(saved);

    const matches = originalPhrase.every((word, idx) => word.toLowerCase() === phrase[idx]?.toLowerCase());
    if (matches) {
      await handleSetupVault(newPin, phrase);
      return true;
    }
    return false;
  };

  const handleLockVault = () => {
    setActivePin('');
    setIsLocked(true);
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <Shield className="w-10 h-10 text-indigo-500 animate-pulse" />
          <span className="text-xs font-semibold">Initializing Moto Secure Cryptographic Hardware Provider...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
        {/* LOCK SCREEN (When locked or unconfigured) */}
        {isLocked ? (
          <PinLockScreen
            isConfigured={isConfigured}
            onUnlock={handleUnlock}
            onSetupVault={handleSetupVault}
            onRecoveryUnlock={handleRecoveryUnlock}
            recoveryPhrase={recoveryPhrase}
          />
        ) : (
          /* UNLOCKED VAULT MAIN INTERFACE */
          <>
            <Header
              activeTab={activeTab}
              onTabChange={setActiveTab}
              isLocked={isLocked}
              onLock={handleLockVault}
              isDark={isDark}
              onToggleTheme={() => setIsDark(!isDark)}
              isUsbMounted={driveInfo.mounted}
            />

            <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 pb-20">
              {activeTab === 'gallery' && (
                <VaultDashboard
                  pin={activePin}
                  onLock={handleLockVault}
                  files={vaultFiles}
                  onFilesChanged={setVaultFiles}
                  driveInfo={driveInfo}
                  onDriveInfoChanged={setDriveInfo}
                />
              )}

              {activeTab === 'testbench' && (
                <SecurityTestBench files={vaultFiles} pin={activePin} />
              )}

              {activeTab === 'android' && <AndroidProjectExplorer />}

              {activeTab === 'threat_model' && <SecurityReviewDocs />}
            </main>

            {/* MOBILE BOTTOM NAVIGATION BAR (Follows 15% mobile sticky cap rule) */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 grid grid-cols-4 h-14">
              <button
                type="button"
                onClick={() => setActiveTab('gallery')}
                className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
                  activeTab === 'gallery' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-400'
                }`}
              >
                <FolderLock className="w-4 h-4" />
                <span>Gallery</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('testbench')}
                className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
                  activeTab === 'testbench' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-400'
                }`}
              >
                <Bug className="w-4 h-4" />
                <span>Security Lab</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('android')}
                className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
                  activeTab === 'android' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-400'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>Android</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('threat_model')}
                className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
                  activeTab === 'threat_model' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-400'
                }`}
              >
                <FileCheck2 className="w-4 h-4" />
                <span>Review</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
