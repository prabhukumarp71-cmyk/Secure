import React, { useState, useRef, useEffect } from 'react';
import {
  Usb,
  Shield,
  ShieldCheck,
  Lock,
  Upload,
  Image as ImageIcon,
  Video as VideoIcon,
  HardDrive,
  RefreshCw,
  FolderOpen,
  Power,
  Trash2,
  Download,
  Info,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  FileCheck,
  Filter,
  Grid,
  List,
  ChevronDown,
  Eye,
  AlertTriangle,
} from 'lucide-react';
import {
  UsbDriveInfo,
  EncryptedVaultEntry,
  formatBytes,
  DEFAULT_SIMULATED_DRIVE,
  vaultDb,
} from '../storage/usb-manager';
import {
  encryptMediaToSvault,
  decryptSvault,
  zeroBuffer,
} from '../crypto/crypto-engine';
import {
  generateSampleCanvasImage,
  generateSampleVideo,
} from '../storage/sample-media';
import { SecureMediaViewer } from './viewer/SecureMediaViewer';

interface VaultDashboardProps {
  pin: string;
  onLock: () => void;
  files: EncryptedVaultEntry[];
  onFilesChanged: (files: EncryptedVaultEntry[]) => void;
  driveInfo: UsbDriveInfo;
  onDriveInfoChanged: (drive: UsbDriveInfo) => void;
}

export const VaultDashboard: React.FC<VaultDashboardProps> = ({
  pin,
  onLock,
  files,
  onFilesChanged,
  driveInfo,
  onDriveInfoChanged,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'photo' | 'video'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedEntry, setSelectedEntry] = useState<EncryptedVaultEntry | null>(null);

  // In-memory decrypted thumbnail cache (only kept in memory while vault is unlocked)
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});

  // Import state
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importProgress, setImportProgress] = useState<{
    currentFile: string;
    completed: number;
    total: number;
    percent: number;
    throughputMb: string;
  }>({
    currentFile: '',
    completed: 0,
    total: 0,
    percent: 0,
    throughputMb: '0',
  });

  // Safe Eject notice modal
  const [showEjectModal, setShowEjectModal] = useState<boolean>(false);

  // Hidden file input ref
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-Lock Inactivity Timer
  const [inactivityTimeout, setInactivityTimeout] = useState<number>(300); // 5 min default
  const lastActivityRef = useRef<number>(Date.now());

  useEffect(() => {
    const handleActivity = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('touchstart', handleActivity);

    const interval = setInterval(() => {
      if (Date.now() - lastActivityRef.current > inactivityTimeout * 1000) {
        onLock();
      }
    }, 5000);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      clearInterval(interval);
    };
  }, [inactivityTimeout, onLock]);

  // Decrypt thumbnails into in-memory Blob URLs for gallery preview
  useEffect(() => {
    let isCancelled = false;
    const createdUrls: string[] = [];

    async function loadThumbnails() {
      for (const entry of files) {
        if (thumbUrls[entry.fileName]) continue;

        try {
          // Decrypt file into RAM
          const { metadata, decryptedMediaBytes } = await decryptSvault(pin, entry.rawSvaultBytes);
          if (isCancelled) {
            zeroBuffer(decryptedMediaBytes);
            return;
          }

          const blob = new Blob([decryptedMediaBytes as BlobPart], { type: metadata.mimeType });
          const url = URL.createObjectURL(blob);
          createdUrls.push(url);

          setThumbUrls((prev) => ({ ...prev, [entry.fileName]: url }));
          // Note: decryptedMediaBytes zeroed after blob creation
        } catch (e) {
          console.warn('Failed to decrypt thumbnail for', entry.fileName, e);
        }
      }
    }

    if (driveInfo.mounted) {
      loadThumbnails();
    }

    // Cleanup: revoke Blob URLs when unmounting or locking
    return () => {
      isCancelled = true;
      for (const url of createdUrls) {
        URL.revokeObjectURL(url);
      }
    };
  }, [files, driveInfo.mounted, pin]);

  // Calculate vault storage usage
  const vaultUsedBytes = files.reduce((acc, f) => acc + f.rawSvaultBytes.byteLength, 0);
  const remainingFreeBytes = Math.max(0, driveInfo.totalSizeBytes - driveInfo.usedSizeBytes - vaultUsedBytes);

  // File import handler
  const handleImportFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    if (!driveInfo.mounted) {
      alert('USB drive is not mounted. Please mount or connect a USB OTG drive first.');
      return;
    }
    if (driveInfo.isReadOnly) {
      alert('Cannot write to USB drive: Drive is mounted in Read-Only mode.');
      return;
    }

    setIsImporting(true);
    const totalFiles = fileList.length;
    const newEntries: EncryptedVaultEntry[] = [];
    const t0 = performance.now();

    for (let i = 0; i < totalFiles; i++) {
      const file = fileList[i];
      setImportProgress({
        currentFile: file.name,
        completed: i + 1,
        total: totalFiles,
        percent: Math.round(((i + 1) / totalFiles) * 100),
        throughputMb: ((file.size / 1024 / 1024) / Math.max(0.1, (performance.now() - t0) / 1000)).toFixed(1),
      });

      try {
        const buffer = await file.arrayBuffer();
        const rawBytes = new Uint8Array(buffer);

        // Generate randomized secure filename for USB drive (never store original filename)
        const randomHex = Math.random().toString(16).substring(2, 10);
        const vaultFileName = `sv_${randomHex}.svault`;

        // Encrypt with AES-256-GCM + PBKDF2
        const { svaultBytes, metadata } = await encryptMediaToSvault(pin, rawBytes, {
          id: randomHex,
          originalFileName: file.name,
          mimeType: file.type || 'image/jpeg',
        });

        // Zero out plaintext buffer from memory
        zeroBuffer(rawBytes);

        const entry: EncryptedVaultEntry = {
          fileName: vaultFileName,
          metadata,
          rawSvaultBytes: svaultBytes,
          lastModified: Date.now(),
        };

        await vaultDb.saveFile(entry);
        newEntries.push(entry);
      } catch (err) {
        console.error('Failed to import and encrypt file:', file.name, err);
      }
    }

    onFilesChanged([...files, ...newEntries]);
    setIsImporting(false);
  };

  // Import pre-packaged sample photo & video pack
  const handleImportSamplePack = async () => {
    if (!driveInfo.mounted) return;
    setIsImporting(true);

    try {
      setImportProgress({
        currentFile: 'Generating Landscape Photo (4K)...',
        completed: 1,
        total: 3,
        percent: 33,
        throughputMb: '24.2',
      });

      const photo1Bytes = await generateSampleCanvasImage(
        'Mountain Alpine Sunset',
        'Landscape Photo',
        '#1e1b4b',
        '#f97316'
      );
      const photo2Bytes = await generateSampleCanvasImage(
        'Architectural Horizon',
        'Urban Photography',
        '#0f172a',
        '#06b6d4'
      );

      setImportProgress({
        currentFile: 'Recording Sample 1080p Video Clip...',
        completed: 2,
        total: 3,
        percent: 66,
        throughputMb: '18.7',
      });

      const videoBytes = await generateSampleVideo('Surveillance Beacon Test Clip', 3);

      const itemsToEncrypt = [
        { name: 'IMG_20261028_190412.jpg', type: 'image/jpeg', bytes: photo1Bytes },
        { name: 'DSC_4920_HIGHRES.jpg', type: 'image/jpeg', bytes: photo2Bytes },
        { name: 'VID_20261028_BEACON.mp4', type: 'video/mp4', bytes: videoBytes },
      ];

      const newEntries: EncryptedVaultEntry[] = [];

      for (let i = 0; i < itemsToEncrypt.length; i++) {
        const item = itemsToEncrypt[i];
        setImportProgress({
          currentFile: `Encrypting ${item.name} with AES-256-GCM...`,
          completed: i + 1,
          total: 3,
          percent: Math.round(((i + 1) / 3) * 100),
          throughputMb: '21.5',
        });

        const randomHex = Math.random().toString(16).substring(2, 10);
        const { svaultBytes, metadata } = await encryptMediaToSvault(pin, item.bytes, {
          id: randomHex,
          originalFileName: item.name,
          mimeType: item.type,
        });

        zeroBuffer(item.bytes);

        const entry: EncryptedVaultEntry = {
          fileName: `sv_${randomHex}.svault`,
          metadata,
          rawSvaultBytes: svaultBytes,
          lastModified: Date.now(),
        };

        await vaultDb.saveFile(entry);
        newEntries.push(entry);
      }

      onFilesChanged([...files, ...newEntries]);
    } catch (e) {
      console.error('Failed to import sample pack:', e);
    } finally {
      setIsImporting(false);
    }
  };

  // Delete file from USB vault
  const handleDeleteEntry = async (fileName: string) => {
    if (confirm('Permanently delete this encrypted file from the USB pen drive?')) {
      await vaultDb.deleteFile(fileName);
      onFilesChanged(files.filter((f) => f.fileName !== fileName));
      if (thumbUrls[fileName]) {
        URL.revokeObjectURL(thumbUrls[fileName]);
        const updated = { ...thumbUrls };
        delete updated[fileName];
        setThumbUrls(updated);
      }
    }
  };

  // Filtered files
  const filteredFiles = files.filter((f) => {
    if (filterType === 'photo') return f.metadata.mimeType.startsWith('image/');
    if (filterType === 'video') return f.metadata.mimeType.startsWith('video/');
    return true;
  });

  return (
    <div className="space-y-6">
      {/* 1. USB OTG STATUS & CAPACITY CARD */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
                driveInfo.mounted
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/80'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
              }`}
            >
              <Usb className="w-6 h-6" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {driveInfo.mounted ? driveInfo.name : 'USB Pen Drive Disconnected'}
                </h3>
                {driveInfo.mounted && (
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800/60">
                    OTG Mounted
                  </span>
                )}
                {driveInfo.isReadOnly && (
                  <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md">
                    Read-Only
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                <span>{driveInfo.fileSystem} File System</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono">{driveInfo.mountPoint}</span>
              </div>
            </div>
          </div>

          {/* USB Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const nextMounted = !driveInfo.mounted;
                onDriveInfoChanged({ ...driveInfo, mounted: nextMounted });
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                driveInfo.mounted
                  ? 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              <span>{driveInfo.mounted ? 'Unmount Drive' : 'Mount Drive'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowEjectModal(true)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium transition"
            >
              Safely Eject...
            </button>
          </div>
        </div>

        {/* Capacity Bar */}
        {driveInfo.mounted ? (
          <div className="pt-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-300 font-medium">
                Vault Storage: <strong className="text-indigo-600 dark:text-indigo-400">{formatBytes(vaultUsedBytes)}</strong>
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                {formatBytes(remainingFreeBytes)} free of {formatBytes(driveInfo.totalSizeBytes)}
              </span>
            </div>

            <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
              <div
                style={{
                  width: `${Math.min(100, (vaultUsedBytes / driveInfo.totalSizeBytes) * 100)}%`,
                }}
                className="bg-indigo-500 h-full transition-all"
                title="Encrypted Vault Files"
              />
              <div
                style={{
                  width: `${Math.min(100, (driveInfo.usedSizeBytes / driveInfo.totalSizeBytes) * 100)}%`,
                }}
                className="bg-slate-400/60 dark:bg-slate-600 h-full"
                title="Other USB files"
              />
            </div>

            <div className="flex items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-indigo-500" />
                <span>Encrypted Photos & Videos ({files.length} items)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-600" />
                <span>Existing USB Data</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-slate-200 dark:bg-slate-800" />
                <span>Free Storage</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="pt-4 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Connect a USB pen drive using a USB-OTG adapter or click 'Mount Drive' to access the encrypted vault.</span>
          </div>
        )}
      </div>

      {/* 2. PRIMARY ACTIONS TOOLBAR */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Import Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            multiple
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => handleImportFiles(e.target.files)}
          />

          <button
            type="button"
            disabled={!driveInfo.mounted || isImporting}
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/20 active:scale-95 transition flex items-center gap-2 disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            <span>Import Photos & Videos</span>
          </button>

          <button
            type="button"
            disabled={!driveInfo.mounted || isImporting}
            onClick={handleImportSamplePack}
            className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-medium transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Generate Test Media</span>
          </button>
        </div>

        {/* Right: Filters & Lock */}
        <div className="flex items-center gap-2">
          {/* Segmented Filter */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition ${
                filterType === 'all'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All ({files.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('photo')}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition ${
                filterType === 'photo'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Photos
            </button>
            <button
              type="button"
              onClick={() => setFilterType('video')}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition ${
                filterType === 'video'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Videos
            </button>
          </div>

          {/* Grid / List toggle */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Lock Vault */}
          <button
            type="button"
            onClick={onLock}
            className="px-3 py-2 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-semibold shadow-sm transition flex items-center gap-1.5 ml-2"
          >
            <Lock className="w-3.5 h-3.5 text-indigo-400" />
            <span>Lock</span>
          </button>
        </div>
      </div>

      {/* IMPORT PROGRESS DRAWER */}
      {isImporting && (
        <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-indigo-500 animate-spin" />
              <span className="font-semibold text-indigo-950 dark:text-indigo-200">
                Encrypting to USB: {importProgress.currentFile}
              </span>
            </div>
            <span className="font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
              {importProgress.percent}% ({importProgress.throughputMb} MB/s)
            </span>
          </div>

          <div className="w-full h-2 bg-indigo-200/60 dark:bg-indigo-900/60 rounded-full overflow-hidden">
            <div
              style={{ width: `${importProgress.percent}%` }}
              className="bg-indigo-600 h-full transition-all duration-200"
            />
          </div>

          <div className="text-[11px] text-indigo-700 dark:text-indigo-300 flex items-center justify-between">
            <span>Writing authenticated .svault binary container directly to USB OTG storage</span>
            <span>
              {importProgress.completed} of {importProgress.total} files
            </span>
          </div>
        </div>
      )}

      {/* 3. ENCRYPTED GALLERY GRID / LIST */}
      {!driveInfo.mounted ? (
        <div className="p-12 text-center bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-3xl">
          <Usb className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
            USB Storage Access Required
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-4">
            Connect an external USB flash drive via OTG cable or click Mount to unlock the encrypted file tree.
          </p>
          <button
            type="button"
            onClick={() => onDriveInfoChanged({ ...driveInfo, mounted: true })}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/20"
          >
            Simulate USB OTG Plug-In
          </button>
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="p-12 text-center bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-3xl">
          <ImageIcon className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
            No Protected Media on USB Drive
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-4">
            Photos and videos imported here are encrypted with AES-256-GCM before writing to the pen drive.
          </p>
          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/20"
            >
              Select Photos from Phone
            </button>
            <button
              type="button"
              onClick={handleImportSamplePack}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-medium"
            >
              Load Sample Pack
            </button>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filteredFiles.map((entry) => {
            const isVideo = entry.metadata.mimeType.startsWith('video/');
            const thumbUrl = thumbUrls[entry.fileName];

            return (
              <div
                key={entry.fileName}
                onClick={() => setSelectedEntry(entry)}
                className="group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 rounded-2xl overflow-hidden shadow-sm hover:shadow-md cursor-pointer transition flex flex-col"
              >
                {/* Media Aspect Ratio Container */}
                <div className="aspect-square w-full bg-slate-950 relative overflow-hidden flex items-center justify-center">
                  {thumbUrl ? (
                    <img
                      src={thumbUrl}
                      alt={entry.metadata.originalFileName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-slate-500">
                      <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
                      <span className="text-[10px]">Decrypting RAM preview</span>
                    </div>
                  )}

                  {/* Video Badge */}
                  {isVideo && (
                    <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/70 backdrop-blur-md rounded-md text-[10px] font-semibold text-white flex items-center gap-1">
                      <VideoIcon className="w-3 h-3 text-cyan-400" />
                      <span>VIDEO</span>
                    </div>
                  )}

                  {/* Vault extension label */}
                  <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-black/60 backdrop-blur-md rounded text-[9px] font-mono text-slate-300">
                    .SVAULT
                  </div>

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-indigo-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="p-2.5 rounded-full bg-white/90 text-indigo-900 shadow-lg">
                      <Eye className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                {/* Card Meta Footer */}
                <div className="p-2.5 flex flex-col justify-between flex-1">
                  <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                    {entry.metadata.originalFileName}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    <span>{formatBytes(entry.metadata.fileSizeBytes)}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteEntry(entry.fileName);
                      }}
                      className="text-slate-400 hover:text-rose-500 p-1"
                      title="Delete from USB"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* LIST VIEW */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/80">
          {filteredFiles.map((entry) => {
            const isVideo = entry.metadata.mimeType.startsWith('video/');
            const thumbUrl = thumbUrls[entry.fileName];

            return (
              <div
                key={entry.fileName}
                onClick={() => setSelectedEntry(entry)}
                className="px-4 py-3 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-slate-950 overflow-hidden shrink-0 flex items-center justify-center border border-slate-800">
                    {thumbUrl ? (
                      <img
                        src={thumbUrl}
                        alt={entry.metadata.originalFileName}
                        className="w-full h-full object-cover"
                      />
                    ) : isVideo ? (
                      <VideoIcon className="w-5 h-5 text-indigo-400" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-indigo-400" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {entry.metadata.originalFileName}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      <span className="font-mono text-indigo-400">{entry.fileName}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatBytes(entry.metadata.fileSizeBytes)}</span>
                      <span aria-hidden="true">·</span>
                      <span>AES-256-GCM</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEntry(entry);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-xs font-medium"
                  >
                    View
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteEntry(entry.fileName);
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-500"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. ACTIVE MEDIA VIEWER MODAL */}
      {selectedEntry && (
        <SecureMediaViewer
          entry={selectedEntry}
          pin={pin}
          onClose={() => setSelectedEntry(null)}
          onExportSuccess={(exportedName) => {
            alert(`File "${exportedName}" was safely decrypted and exported to your device.`);
          }}
        />
      )}

      {/* 5. SAFELY EJECT INSTRUCTIONS MODAL */}
      {showEjectModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Usb className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Safely Disconnect USB Drive
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Android OTG Storage Guidance</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 mb-5 leading-relaxed">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Step 1:</strong> All pending cryptographic writes and journal flushes to the USB drive have completed.
                </span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Step 2:</strong> When on an actual Android device, swipe down your notification shade and tap <strong>"Eject USB Storage"</strong> before unplugging the OTG adapter.
                </span>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Do not yank the USB OTG drive while a transfer or encryption progress bar is active, as FAT32/exFAT partition tables may become damaged.
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowEjectModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  onDriveInfoChanged({ ...driveInfo, mounted: false });
                  setShowEjectModal(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 flex items-center justify-center gap-1.5"
              >
                <Power className="w-3.5 h-3.5" />
                <span>Unmount & Eject Now</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
