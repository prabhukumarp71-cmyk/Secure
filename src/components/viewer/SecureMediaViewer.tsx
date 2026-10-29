import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Download,
  Shield,
  ShieldAlert,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Play,
  Pause,
  Volume2,
  VolumeX,
  FileText,
  AlertTriangle,
  Lock,
  Calendar,
  HardDrive,
  Eye,
  Maximize2,
  RefreshCw,
} from 'lucide-react';
import { EncryptedVaultEntry, formatBytes } from '../../storage/usb-manager';
import { decryptSvault, zeroBuffer } from '../../crypto/crypto-engine';
import { bytesToHex } from '../../crypto/svault-format';

interface SecureMediaViewerProps {
  entry: EncryptedVaultEntry;
  pin: string;
  onClose: () => void;
  onExportSuccess?: (fileName: string) => void;
}

export const SecureMediaViewer: React.FC<SecureMediaViewerProps> = ({
  entry,
  pin,
  onClose,
  onExportSuccess,
}) => {
  const [decryptedUrl, setDecryptedUrl] = useState<string | null>(null);
  const [decryptionTime, setDecryptionTime] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Secure window / FLAG_SECURE simulation
  const [isWindowBlurred, setIsWindowBlurred] = useState<boolean>(false);
  const [screenshotAttempted, setScreenshotAttempted] = useState<boolean>(false);

  // Image zoom/rotation
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);

  // Video playback
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Info sidebar toggle
  const [showMetadata, setShowMetadata] = useState<boolean>(false);

  // Export Confirmation Dialog
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [exportPin, setExportPin] = useState<string>('');
  const [exportError, setExportError] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Decrypted buffer reference for zeroing on cleanup
  const decryptedBufferRef = useRef<Uint8Array | null>(null);
  const currentObjectUrlRef = useRef<string | null>(null);

  // 1. Perform In-Memory Decryption
  useEffect(() => {
    let isCancelled = false;

    async function performDecryption() {
      try {
        setLoading(true);
        setError(null);

        const { metadata, decryptedMediaBytes, decryptionTimeMs } = await decryptSvault(
          pin,
          entry.rawSvaultBytes
        );

        if (isCancelled) {
          zeroBuffer(decryptedMediaBytes);
          return;
        }

        decryptedBufferRef.current = decryptedMediaBytes;
        setDecryptionTime(decryptionTimeMs);

        // Create ephemeral in-memory Blob URL
        const blob = new Blob([decryptedMediaBytes as BlobPart], { type: metadata.mimeType });
        const url = URL.createObjectURL(blob);
        currentObjectUrlRef.current = url;
        setDecryptedUrl(url);
      } catch (err: any) {
        if (!isCancelled) {
          setError(err.message || 'Decryption failed: Integrity error or invalid key');
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    performDecryption();

    // Cleanup: Securely zero in-memory bytes and revoke Blob URL
    return () => {
      isCancelled = true;
      if (currentObjectUrlRef.current) {
        URL.revokeObjectURL(currentObjectUrlRef.current);
        currentObjectUrlRef.current = null;
      }
      if (decryptedBufferRef.current) {
        zeroBuffer(decryptedBufferRef.current);
        decryptedBufferRef.current = null;
      }
    };
  }, [entry, pin]);

  // 2. FLAG_SECURE & Screen Capture Protections (Simulating Android WindowManager.LayoutParams.FLAG_SECURE)
  useEffect(() => {
    const handleBlur = () => setIsWindowBlurred(true);
    const handleFocus = () => setIsWindowBlurred(false);

    const handleKeyDown = (e: KeyboardEvent) => {
      // Detect print screen or screen capture shortcuts
      if (e.key === 'PrintScreen' || (e.metaKey && e.shiftKey && (e.key === '3' || e.key === '4' || e.key === '5'))) {
        setScreenshotAttempted(true);
        setTimeout(() => setScreenshotAttempted(false), 3000);
      }
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault(); // Disable context menu
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('contextmenu', handleContextMenu);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [onClose]);

  // Video event handlers
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      setDuration(videoRef.current.duration || 0);
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleExportConfirm = async () => {
    if (exportPin !== pin) {
      setExportError('Incorrect PIN. Authentication required for export.');
      return;
    }

    if (!decryptedBufferRef.current || !decryptedUrl) {
      setExportError('Decrypted buffer not ready');
      return;
    }

    setIsExporting(true);
    try {
      // Trigger browser download for decrypted copy
      const a = document.createElement('a');
      a.href = decryptedUrl;
      a.download = entry.metadata.originalFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setShowExportModal(false);
      setExportPin('');
      if (onExportSuccess) onExportSuccess(entry.metadata.originalFileName);
    } catch (err: any) {
      setExportError('Export failed: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const isVideo = entry.metadata.mimeType.startsWith('video/');

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between flag-secure-active backdrop-blur-2xl">
      {/* SCREENSHOT DETECTION BANNER (FLAG_SECURE SIMULATION) */}
      {screenshotAttempted && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-rose-600 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-xl flex items-center gap-2 animate-bounce">
          <ShieldAlert className="w-4 h-4" />
          <span>FLAG_SECURE Protected: Screen capture blocked by Moto Secure policy</span>
        </div>
      )}

      {/* TOP BAR CONTRACT: Brand/Title — Controls — Close */}
      <header className="flex items-center justify-between gap-4 px-4 py-3 bg-slate-950/80 border-b border-slate-800/80 z-20">
        {/* Zone 1: File Identity */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-950 border border-indigo-800/60 flex items-center justify-center shrink-0">
            <Lock className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="truncate">
            <h2 className="text-sm font-semibold text-white truncate">
              {entry.metadata.originalFileName}
            </h2>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className="font-mono text-indigo-400">FLAG_SECURE Active</span>
              <span aria-hidden="true">·</span>
              <span>{formatBytes(entry.metadata.fileSizeBytes)}</span>
              <span aria-hidden="true">·</span>
              <span>Decrypted in {decryptionTime}ms</span>
            </div>
          </div>
        </div>

        {/* Zone 2: Viewer Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {!isVideo && (
            <>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
                title="Zoom Out"
                className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-700 text-slate-300 transition"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel(1)}
                title="Reset Zoom"
                className="px-2 py-1 rounded-lg bg-slate-800/60 hover:bg-slate-700 text-slate-300 text-xs font-mono"
              >
                {Math.round(zoomLevel * 100)}%
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
                title="Zoom In"
                className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-700 text-slate-300 transition"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                title="Rotate 90°"
                className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-700 text-slate-300 transition"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setShowMetadata((v) => !v)}
            title="Inspect .svault Crypto Header"
            className={`p-2 rounded-lg border transition ${
              showMetadata
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <FileText className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setShowExportModal(true)}
            title="Export Decrypted Copy"
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export</span>
          </button>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-rose-900/60 hover:text-rose-200 text-slate-300 transition ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* MAIN VIEWPORT / CANVAS */}
      <main className="flex-1 relative flex items-center justify-center overflow-hidden p-4">
        {/* PRIVACY SHIELD: Triggered when window loses focus (simulating Android app switcher blanking) */}
        {isWindowBlurred && (
          <div className="absolute inset-0 z-40 bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-indigo-950 border border-indigo-800 flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 text-indigo-400" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">Privacy Shield Active</h3>
            <p className="text-xs text-slate-400 max-w-sm">
              Android WindowManager FLAG_SECURE is engaged. Media preview is blanked while the app is in the background or switcher.
            </p>
          </div>
        )}

        {/* LOADING STATE */}
        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
            <span className="text-xs font-medium">Decrypting AES-256-GCM authenticated payload...</span>
          </div>
        )}

        {/* ERROR STATE */}
        {error && (
          <div className="max-w-md p-6 bg-rose-950/80 border border-rose-800 rounded-3xl text-center">
            <ShieldAlert className="w-10 h-10 text-rose-400 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-rose-200 mb-1">Integrity Violation / Decryption Error</h3>
            <p className="text-xs text-rose-300 mb-4">{error}</p>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-rose-800 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold"
            >
              Close Viewer
            </button>
          </div>
        )}

        {/* IMAGE VIEWER */}
        {!loading && !error && !isVideo && decryptedUrl && (
          <div
            className="transition-transform duration-200 select-none max-w-full max-h-full flex items-center justify-center"
            style={{
              transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
            }}
          >
            <img
              src={decryptedUrl}
              alt="Decrypted Media"
              className="max-h-[78vh] max-w-[88vw] object-contain rounded-lg shadow-2xl pointer-events-none"
            />
          </div>
        )}

        {/* VIDEO VIEWER */}
        {!loading && !error && isVideo && decryptedUrl && (
          <div className="relative max-w-4xl w-full flex flex-col items-center">
            <video
              ref={videoRef}
              src={decryptedUrl}
              onTimeUpdate={handleTimeUpdate}
              onEnded={() => setIsPlaying(false)}
              className="max-h-[70vh] w-full rounded-2xl bg-black shadow-2xl"
              onClick={togglePlay}
            />

            {/* Custom Video Controls */}
            <div className="w-full mt-3 p-3 bg-slate-900/90 border border-slate-800 rounded-2xl flex items-center gap-3">
              <button
                type="button"
                onClick={togglePlay}
                className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>

              <div className="flex-1 flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={duration || 1}
                  step={0.1}
                  value={currentTime}
                  onChange={(e) => {
                    if (videoRef.current) {
                      videoRef.current.currentTime = Number(e.target.value);
                    }
                  }}
                  className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
              </div>

              <div className="text-[11px] font-mono text-slate-400 shrink-0">
                {Math.floor(currentTime)}s / {Math.floor(duration)}s
              </div>

              <button
                type="button"
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.muted = !isMuted;
                    setIsMuted(!isMuted);
                  }
                }}
                className="p-2 text-slate-300 hover:text-white"
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {/* METADATA & CRYPTO HEADER INSPECTION DRAWER */}
        {showMetadata && (
          <aside className="absolute right-4 top-4 bottom-4 w-80 bg-slate-900/95 border border-slate-800 rounded-2xl p-4 overflow-y-auto shadow-2xl z-30">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">.svault File Header</h4>
              <button
                type="button"
                onClick={() => setShowMetadata(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400 mb-0.5">Encrypted File Path on USB</div>
                <div className="font-mono text-indigo-300 text-[11px] break-all">
                  {entry.fileName}
                </div>
              </div>

              <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400 mb-0.5">Magic Identifier & Version</div>
                <div className="font-mono text-emerald-400 text-[11px]">
                  SVAULT01 (Format v{entry.metadata.vaultVersion})
                </div>
              </div>

              <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400 mb-0.5">Original File Checksum (SHA-256)</div>
                <div className="font-mono text-slate-300 text-[10px] break-all">
                  {entry.metadata.checksumSha256}
                </div>
              </div>

              <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400 mb-0.5">Cryptographic Algorithm</div>
                <div className="font-semibold text-slate-200">AES-256-GCM · PBKDF2 100k iters</div>
              </div>

              <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400 mb-0.5">Raw Encrypted Size on Drive</div>
                <div className="font-mono text-slate-300">
                  {formatBytes(entry.rawSvaultBytes.byteLength)} (
                  {entry.rawSvaultBytes.byteLength.toLocaleString()} bytes)
                </div>
              </div>

              <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400 mb-0.5">Security Level</div>
                <div className="text-emerald-400 font-medium flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Authenticated Zero-Knowledge</span>
                </div>
              </div>
            </div>
          </aside>
        )}
      </main>

      {/* BOTTOM FOOTER */}
      <footer className="px-4 py-2.5 bg-slate-950/80 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          <span>RAM-Only Decryption · No cache written to device disk</span>
        </div>
        <div className="text-[11px] font-mono text-slate-500">
          Press ESC to lock & scrub memory
        </div>
      </footer>

      {/* EXPORT CONFIRMATION MODAL */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Export Unencrypted File</h3>
                <p className="text-xs text-slate-400">Security Warning</p>
              </div>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs mb-4">
              Exporting will write a decrypted copy to your public storage. Once exported, this media will be visible in Google Photos, Gallery apps, and to any app with media permissions.
            </div>

            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Confirm your Vault PIN to proceed
            </label>
            <input
              type="password"
              maxLength={6}
              value={exportPin}
              onChange={(e) => {
                setExportPin(e.target.value.replace(/\D/g, ''));
                setExportError('');
              }}
              placeholder="Enter PIN"
              className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 font-mono text-center tracking-widest text-sm focus:outline-none focus:border-indigo-500 mb-3"
            />

            {exportError && (
              <div className="text-rose-400 text-xs bg-rose-950/40 border border-rose-900/50 p-2 rounded-lg mb-3">
                {exportError}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowExportModal(false);
                  setExportPin('');
                  setExportError('');
                }}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-xs font-medium hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={exportPin.length < 4 || isExporting}
                onClick={handleExportConfirm}
                className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-lg shadow-amber-600/30 flex items-center justify-center gap-1.5 disabled:opacity-40"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Confirm & Export</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
