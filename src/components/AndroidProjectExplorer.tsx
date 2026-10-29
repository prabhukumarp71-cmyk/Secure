import React, { useState } from 'react';
import {
  FolderCode,
  FileCode,
  Download,
  Copy,
  Check,
  Smartphone,
  Shield,
  Terminal,
  ExternalLink,
  Code2,
  FileCheck,
  GitBranch,
  Github,
} from 'lucide-react';
import JSZip from 'jszip';
import { ANDROID_PROJECT_FILES, AndroidFile } from '../android-code/project-files';

export const AndroidProjectExplorer: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<AndroidFile>(ANDROID_PROJECT_FILES[5]); // Default to CryptoEngine.kt
  const [copied, setCopied] = useState<boolean>(false);
  const [isZipping, setIsZipping] = useState<boolean>(false);
  const [copiedGitCmd, setCopiedGitCmd] = useState<boolean>(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadZip = async (type: 'android_only' | 'github_repo' = 'android_only') => {
    setIsZipping(true);
    try {
      const zip = new JSZip();

      if (type === 'android_only') {
        // Add all project files into root zip directory
        for (const file of ANDROID_PROJECT_FILES) {
          zip.file(file.path, file.content);
        }
        zip.file(
          'app/src/main/res/xml/device_filter.xml',
          `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <!-- Mass Storage Class 0x08 -->\n    <usb-device class="8" />\n</resources>`
        );
      } else {
        // Complete GitHub repository bundle
        for (const file of ANDROID_PROJECT_FILES) {
          if (file.path.startsWith('.github') || file.path === 'LICENSE' || file.path === 'SECURITY.md' || file.path === 'CONTRIBUTING.md' || file.path === 'README.md') {
            zip.file(file.path, file.content);
          } else {
            zip.file(`android/${file.path}`, file.content);
          }
        }
        zip.file(
          'android/app/src/main/res/xml/device_filter.xml',
          `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <!-- Mass Storage Class 0x08 -->\n    <usb-device class="8" />\n</resources>`
        );
        zip.file('.gitignore', `# Android & Gradle\n.gradle/\nbuild/\nlocal.properties\n*.iml\n.idea/\n*.jks\n*.keystore\n\n# Node\nnode_modules/\ndist/\n.DS_Store\n`);
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = type === 'android_only' ? 'MotoSecureUsbVault-AndroidStudio.zip' : 'moto-secure-usb-vault-github.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('ZIP generation failed:', err);
    } finally {
      setIsZipping(false);
    }
  };

  const gitPushCommand = `git init
git add .
git commit -m "feat: Moto Secure USB Photo Vault for Android"
git branch -M main
git remote add origin https://github.com/<your-username>/moto-secure-usb-vault.git
git push -u origin main`;

  const handleCopyGitCmd = () => {
    navigator.clipboard.writeText(gitPushCommand);
    setCopiedGitCmd(true);
    setTimeout(() => setCopiedGitCmd(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-indigo-500" />
            <span>Complete Android Studio & GitHub Repository Source</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Production-grade Kotlin & Jetpack Compose codebase with GitHub CI workflows and Apache 2.0 license.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isZipping}
            onClick={() => handleDownloadZip('android_only')}
            className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Android Studio (.zip)</span>
          </button>

          <button
            type="button"
            disabled={isZipping}
            onClick={() => handleDownloadZip('github_repo')}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/20 transition flex items-center gap-2 shrink-0 disabled:opacity-50"
          >
            <Github className="w-4 h-4" />
            <span>{isZipping ? 'Bundling...' : 'Download for GitHub (.zip)'}</span>
          </button>
        </div>
      </div>

      {/* CODE EXPLORER GRID: Sidebar Tree + Code Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* SIDEBAR: File Tree */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 space-y-1 max-h-[640px] overflow-y-auto">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 mb-1">
            Project Files ({ANDROID_PROJECT_FILES.length})
          </div>

          {ANDROID_PROJECT_FILES.map((file) => {
            const isSelected = selectedFile.path === file.path;
            return (
              <button
                key={file.path}
                type="button"
                onClick={() => setSelectedFile(file)}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center gap-2 transition ${
                  isSelected
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-semibold border border-indigo-200 dark:border-indigo-800/80'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                <FileCode className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-indigo-500' : 'text-slate-400'}`} />
                <span className="truncate">{file.path}</span>
              </button>
            );
          })}
        </div>

        {/* CODE PREVIEW WINDOW */}
        <div className="lg:col-span-8 bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col">
          {/* Top Window Bar */}
          <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-300 font-mono">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500/80" />
              <span>{selectedFile.path}</span>
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition flex items-center gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Source'}</span>
            </button>
          </div>

          {/* Syntax Code View */}
          <pre className="p-4 font-mono text-xs text-slate-200 overflow-x-auto max-h-[580px] leading-relaxed selection:bg-indigo-700 selection:text-white">
            <code>{selectedFile.content}</code>
          </pre>
        </div>
      </div>

      {/* QUICK INSTRUCTIONS & GITHUB PUSH GUIDE */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Android Studio Quick Start */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0 mt-0.5">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                Android Studio Quick Start
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Extract <code className="font-mono text-indigo-400">MotoSecureUsbVault-AndroidStudio.zip</code> → Open in Android Studio Hedgehog / Iguana / Jellyfish → Build and test on Android 10+ devices.
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800/60 flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-500">Target SDK: 35 · Min SDK: 29</span>
            <button
              type="button"
              onClick={() => handleDownloadZip('android_only')}
              className="text-xs text-indigo-500 hover:text-indigo-400 font-semibold flex items-center gap-1"
            >
              <span>Download Studio ZIP</span>
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* GitHub Repository Push Guide */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
              <Github className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Push to GitHub Repository
                </span>
                <button
                  type="button"
                  onClick={handleCopyGitCmd}
                  className="text-[11px] text-indigo-500 hover:text-indigo-400 font-medium flex items-center gap-1"
                >
                  {copiedGitCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedGitCmd ? 'Copied' : 'Copy Git Commands'}</span>
                </button>
              </div>
              <pre className="mt-2 p-2.5 bg-slate-950 rounded-xl font-mono text-[10px] text-slate-300 overflow-x-auto leading-relaxed border border-slate-800">
                <code>{gitPushCommand}</code>
              </pre>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800/60 flex items-center justify-between">
            <span className="text-[11px] text-emerald-500 font-medium flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              <span>CI Workflows & Badges Included</span>
            </span>
            <button
              type="button"
              onClick={() => handleDownloadZip('github_repo')}
              className="text-xs text-indigo-500 hover:text-indigo-400 font-semibold flex items-center gap-1"
            >
              <span>Export Full GitHub ZIP</span>
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
