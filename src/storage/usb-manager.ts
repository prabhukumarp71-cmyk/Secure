/**
 * USB OTG and Storage Access Framework (SAF) Manager
 * Provides abstraction for:
 * 1. Real physical USB drives via Web File System Access API (showDirectoryPicker)
 * 2. Virtual Android USB OTG emulation with exFAT/FAT32/NTFS filesystem simulation
 * 3. Hotplug / Disconnection detection, storage metrics, and read-only protection
 */

import { VaultFileMetadata } from '../crypto/svault-format';

export interface UsbDriveInfo {
  id: string;
  name: string;
  manufacturer: string;
  fileSystem: 'exFAT' | 'FAT32' | 'NTFS';
  totalSizeBytes: number;
  usedSizeBytes: number;
  isPhysical: boolean;
  isReadOnly: boolean;
  mounted: boolean;
  mountPoint: string;
}

export interface EncryptedVaultEntry {
  fileName: string; // e.g. "sv_8f9a2c.svault" (randomized identifier, never original name)
  metadata: VaultFileMetadata;
  rawSvaultBytes: Uint8Array;
  lastModified: number;
}

const DEFAULT_SIMULATED_DRIVE: UsbDriveInfo = {
  id: 'usb-otg-sandisk-01',
  name: 'SanDisk Ultra Dual Drive Luxe OTG',
  manufacturer: 'SanDisk / Western Digital',
  fileSystem: 'exFAT',
  totalSizeBytes: 64 * 1024 * 1024 * 1024, // 64 GB
  usedSizeBytes: 8.4 * 1024 * 1024 * 1024, // 8.4 GB used by other files
  isPhysical: false,
  isReadOnly: false,
  mounted: true,
  mountPoint: '/storage/1A2B-3C4D/Android/media/com.motosecure.usbvault/',
};

const DB_NAME = 'SecureUsbPhotoVaultDB';
const STORE_NAME = 'encrypted_svault_files';

/**
 * Simple IndexedDB wrapper for persistent local storage of encrypted .svault files
 */
class VaultStorageDB {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'fileName' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return this.dbPromise;
  }

  async getAllFiles(): Promise<EncryptedVaultEntry[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async saveFile(entry: EncryptedVaultEntry): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(entry);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async deleteFile(fileName: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(fileName);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async clearAll(): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}

export const vaultDb = new VaultStorageDB();

/**
 * Format bytes into human readable format (MB, GB)
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export { DEFAULT_SIMULATED_DRIVE };
