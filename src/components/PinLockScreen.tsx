import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Lock,
  Delete,
  Fingerprint,
  RefreshCw,
  KeyRound,
  Eye,
  EyeOff,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  Copy,
  Check,
} from 'lucide-react';
import { validateRecoveryPhrase } from '../crypto/recovery';

interface PinLockScreenProps {
  isConfigured: boolean;
  onUnlock: (pin: string) => Promise<boolean>;
  onSetupVault: (pin: string, recoveryPhrase: string[]) => Promise<void>;
  onRecoveryUnlock: (phrase: string[], newPin: string) => Promise<boolean>;
  recoveryPhrase: string[];
  maxAttempts?: number;
}

export const PinLockScreen: React.FC<PinLockScreenProps> = ({
  isConfigured,
  onUnlock,
  onSetupVault,
  onRecoveryUnlock,
  recoveryPhrase,
  maxAttempts = 3,
}) => {
  // State for PIN entry
  const [pin, setPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [setupStep, setSetupStep] = useState<'enter_pin' | 'confirm_pin' | 'show_recovery'>('enter_pin');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [scrambleKeypad, setScrambleKeypad] = useState<boolean>(false);
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);
  const [showRecoveryModal, setShowRecoveryModal] = useState<boolean>(false);
  const [recoveryInput, setRecoveryInput] = useState<string>('');
  const [recoveryNewPin, setRecoveryNewPin] = useState<string>('');
  const [copiedRecovery, setCopiedRecovery] = useState<boolean>(false);
  const [biometricSimulating, setBiometricSimulating] = useState<boolean>(false);
  const [shakeError, setShakeError] = useState<boolean>(false);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const interval = setInterval(() => {
      setLockoutSeconds((sec) => {
        if (sec <= 1) {
          clearInterval(interval);
          setFailedAttempts(0);
          return 0;
        }
        return sec - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutSeconds]);

  // Digits array for keypad (standard or scrambled)
  const digits = useMemo(() => {
    const defaultDigits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    if (!scrambleKeypad) return defaultDigits;
    const shuffled = [...defaultDigits];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, [scrambleKeypad]);

  const handleKeyPress = (num: number) => {
    if (lockoutSeconds > 0 || isVerifying) return;
    setErrorMsg('');
    if (pin.length < 6) {
      const newPin = pin + num.toString();
      setPin(newPin);
      if (isConfigured && newPin.length >= 4) {
        // Auto-check if 4 or 6 digits
        if (newPin.length === 6 || (newPin.length === 4 && !isConfigured)) {
          // let user click unlock or auto-verify at 6
        }
      }
    }
  };

  const handleDelete = () => {
    if (lockoutSeconds > 0 || isVerifying) return;
    setErrorMsg('');
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (lockoutSeconds > 0 || isVerifying) return;
    setPin('');
    setErrorMsg('');
  };

  const triggerErrorShake = (msg: string) => {
    setErrorMsg(msg);
    setShakeError(true);
    setTimeout(() => setShakeError(false), 500);
  };

  const handleUnlockSubmit = async (customPin?: string) => {
    const pinToTest = customPin || pin;
    if (pinToTest.length < 4) {
      triggerErrorShake('PIN must be at least 4 digits');
      return;
    }

    setIsVerifying(true);
    setErrorMsg('');

    try {
      const success = await onUnlock(pinToTest);
      if (!success) {
        const nextAttempts = failedAttempts + 1;
        setFailedAttempts(nextAttempts);
        setPin('');

        if (nextAttempts >= maxAttempts) {
          const timeout = 30 * Math.pow(2, Math.floor((nextAttempts - maxAttempts) / 2));
          setLockoutSeconds(timeout);
          triggerErrorShake(`Too many incorrect attempts. Vault locked for ${timeout}s.`);
        } else {
          const remaining = maxAttempts - nextAttempts;
          triggerErrorShake(`Incorrect PIN. ${remaining} ${remaining === 1 ? 'attempt' : 'attempts'} remaining.`);
        }
      } else {
        setFailedAttempts(0);
      }
    } catch (err: any) {
      triggerErrorShake(err.message || 'Decryption failed: Incorrect PIN');
      setPin('');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSetupNext = async () => {
    if (setupStep === 'enter_pin') {
      if (pin.length < 4 || pin.length > 8) {
        triggerErrorShake('PIN must be between 4 and 8 digits');
        return;
      }
      setConfirmPin('');
      setSetupStep('confirm_pin');
    } else if (setupStep === 'confirm_pin') {
      if (pin !== confirmPin) {
        triggerErrorShake('PINs do not match. Please re-enter.');
        setConfirmPin('');
        return;
      }
      setSetupStep('show_recovery');
    } else if (setupStep === 'show_recovery') {
      await onSetupVault(pin, recoveryPhrase);
    }
  };

  const handleBiometricSimulation = () => {
    if (!isConfigured || lockoutSeconds > 0) return;
    setBiometricSimulating(true);
    setTimeout(() => {
      setBiometricSimulating(false);
      // Simulate Android Keystore BiometricPrompt prompt success with stored PIN in Keystore
      // We trigger unlock with the demo PIN or notify user
      handleUnlockSubmit('1234');
    }, 1200);
  };

  const handleCopyRecovery = () => {
    navigator.clipboard.writeText(recoveryPhrase.join(' '));
    setCopiedRecovery(true);
    setTimeout(() => setCopiedRecovery(false), 2000);
  };

  const handleRecoverySubmit = async () => {
    const words = recoveryInput
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 0);

    if (words.length !== 12) {
      setErrorMsg('Recovery phrase must contain exactly 12 words');
      return;
    }
    if (!validateRecoveryPhrase(words)) {
      setErrorMsg('One or more words are not in the valid recovery wordlist');
      return;
    }
    if (recoveryNewPin.length < 4) {
      setErrorMsg('New PIN must be at least 4 digits');
      return;
    }

    setIsVerifying(true);
    try {
      const ok = await onRecoveryUnlock(words, recoveryNewPin);
      if (ok) {
        setShowRecoveryModal(false);
        setRecoveryInput('');
        setRecoveryNewPin('');
        setFailedAttempts(0);
        setLockoutSeconds(0);
      } else {
        setErrorMsg('Invalid recovery phrase for this vault.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Recovery failed');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 select-none">
      <div
        className={`w-full max-w-sm bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-xl transition-transform ${
          shakeError ? 'animate-bounce' : ''
        }`}
      >
        {/* Brand Lock Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-500 p-0.5 shadow-lg shadow-indigo-500/20 mb-3 flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              {lockoutSeconds > 0 ? (
                <ShieldAlert className="w-8 h-8 text-rose-500 animate-pulse" />
              ) : isConfigured ? (
                <Shield className="w-8 h-8 text-indigo-400" />
              ) : (
                <KeyRound className="w-8 h-8 text-cyan-400" />
              )}
            </div>
          </div>

          <h1 className="text-xl font-bold tracking-tight text-white">
            {!isConfigured
              ? setupStep === 'enter_pin'
                ? 'Create Vault PIN'
                : setupStep === 'confirm_pin'
                ? 'Confirm Vault PIN'
                : 'Emergency Recovery Key'
              : 'Moto Secure USB Vault'}
          </h1>

          <p className="text-xs text-slate-400 mt-1 max-w-[260px]">
            {!isConfigured
              ? setupStep === 'show_recovery'
                ? 'Store these 12 words offline. There is no backdoor.'
                : 'Photos on USB drive are encrypted with AES-256-GCM.'
              : lockoutSeconds > 0
              ? `Throttled: Wait ${lockoutSeconds}s to re-try`
              : 'Enter your PIN to mount and decrypt vault'}
          </p>
        </div>

        {/* SETUP STEP 3: SHOW 12-WORD RECOVERY PHRASE */}
        {!isConfigured && setupStep === 'show_recovery' ? (
          <div className="space-y-4">
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Zero-Knowledge Notice: If you lose both your PIN and this recovery phrase, your encrypted files cannot be recovered by anyone.
              </span>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 grid grid-cols-3 gap-2">
              {recoveryPhrase.map((word, idx) => (
                <div key={idx} className="flex items-center gap-1.5 text-xs py-1 px-2 bg-slate-900 rounded-lg">
                  <span className="text-slate-500 font-mono text-[10px] w-4">{idx + 1}.</span>
                  <span className="font-mono text-slate-200 font-medium">{word}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCopyRecovery}
                className="flex-1 py-2.5 px-3 rounded-xl border border-slate-700 bg-slate-800 text-slate-200 text-xs font-medium hover:bg-slate-700 transition flex items-center justify-center gap-2"
              >
                {copiedRecovery ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                {copiedRecovery ? 'Copied to Clipboard' : 'Copy Words'}
              </button>

              <button
                type="button"
                onClick={handleSetupNext}
                className="flex-1 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-1.5"
              >
                <span>I Saved It · Finish</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* STANDARD PIN ENTRY & KEYPAD */
          <>
            {/* PIN Indicator Dots */}
            <div className="flex justify-center items-center gap-3 my-4">
              {[0, 1, 2, 3, 4, 5].map((idx) => {
                const currentVal = !isConfigured && setupStep === 'confirm_pin' ? confirmPin : pin;
                const isFilled = idx < currentVal.length;
                return (
                  <div
                    key={idx}
                    className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
                      isFilled
                        ? 'bg-indigo-400 scale-125 shadow-md shadow-indigo-500/50'
                        : 'bg-slate-800 border border-slate-700'
                    }`}
                  />
                );
              })}
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="text-rose-400 text-xs text-center font-medium my-2 bg-rose-950/40 border border-rose-900/50 py-1 px-3 rounded-lg">
                {errorMsg}
              </div>
            )}

            {/* Numeric Keypad Grid */}
            <div className="grid grid-cols-3 gap-2.5 my-3">
              {digits.map((num) => (
                <button
                  key={num}
                  type="button"
                  disabled={lockoutSeconds > 0 || isVerifying}
                  onClick={() => {
                    if (!isConfigured && setupStep === 'confirm_pin') {
                      if (confirmPin.length < 6) setConfirmPin((p) => p + num.toString());
                    } else {
                      handleKeyPress(num);
                    }
                  }}
                  className="h-14 rounded-2xl bg-slate-800/80 hover:bg-slate-750 active:bg-indigo-900/40 active:scale-95 border border-slate-700/60 text-xl font-semibold text-white transition flex items-center justify-center disabled:opacity-40 disabled:pointer-events-none"
                >
                  {num}
                </button>
              ))}

              {/* Bottom Row: Clear / Biometric / 0 / Backspace */}
              <button
                type="button"
                disabled={lockoutSeconds > 0 || isVerifying}
                onClick={handleBiometricSimulation}
                title="Android Biometric Fingerprint (simulation)"
                className="h-14 rounded-2xl bg-slate-800/40 hover:bg-slate-800 border border-slate-800 text-xs text-indigo-400 font-medium transition flex flex-col items-center justify-center gap-1 disabled:opacity-30"
              >
                <Fingerprint className={`w-5 h-5 ${biometricSimulating ? 'text-indigo-400 animate-ping' : ''}`} />
                <span className="text-[10px]">Biometric</span>
              </button>

              <button
                type="button"
                disabled={lockoutSeconds > 0 || isVerifying}
                onClick={() => {
                  if (!isConfigured && setupStep === 'confirm_pin') {
                    if (confirmPin.length < 6) setConfirmPin((p) => p + '0');
                  } else {
                    handleKeyPress(0);
                  }
                }}
                className="h-14 rounded-2xl bg-slate-800/80 hover:bg-slate-750 active:bg-indigo-900/40 active:scale-95 border border-slate-700/60 text-xl font-semibold text-white transition flex items-center justify-center disabled:opacity-40 disabled:pointer-events-none"
              >
                0
              </button>

              <button
                type="button"
                disabled={lockoutSeconds > 0 || isVerifying}
                onClick={() => {
                  if (!isConfigured && setupStep === 'confirm_pin') {
                    setConfirmPin((p) => p.slice(0, -1));
                  } else {
                    handleDelete();
                  }
                }}
                className="h-14 rounded-2xl bg-slate-800/40 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition flex items-center justify-center active:scale-95 disabled:opacity-40"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800/80 text-xs">
              {/* Scramble Keypad feature from Moto Secure */}
              <button
                type="button"
                onClick={() => setScrambleKeypad((v) => !v)}
                className={`flex items-center gap-1.5 transition ${
                  scrambleKeypad ? 'text-indigo-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Scrambles number pad keys randomly to prevent fingerprint smudges or shoulder surfing"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${scrambleKeypad ? 'rotate-180 transition-transform' : ''}`} />
                <span>Scramble Keys</span>
              </button>

              {/* Forgot PIN / Recovery */}
              {isConfigured ? (
                <button
                  type="button"
                  onClick={() => setShowRecoveryModal(true)}
                  className="text-indigo-400 hover:text-indigo-300 font-medium transition"
                >
                  Forgot PIN?
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSetupNext}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold flex items-center gap-1 shadow-md shadow-indigo-600/30"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Submit button when configured */}
            {isConfigured && (
              <button
                type="button"
                disabled={pin.length < 4 || lockoutSeconds > 0 || isVerifying}
                onClick={() => handleUnlockSubmit()}
                className="w-full mt-3 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold text-sm shadow-lg shadow-indigo-600/25 active:scale-[0.98] transition disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {isVerifying ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Authenticating & Deriving Key...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Unlock Vault</span>
                  </>
                )}
              </button>
            )}
          </>
        )}

        {/* Security badge at bottom */}
        <div className="mt-5 pt-3 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>FIPS-compliant AES-256-GCM · Android Keystore isolation</span>
        </div>
      </div>

      {/* EMERGENCY RECOVERY PHRASE MODAL */}
      {showRecoveryModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Emergency Vault Recovery</h3>
                <p className="text-xs text-slate-400">Zero-knowledge recovery using your 12-word phrase</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 mb-3">
              Enter the 12 secret words generated when you set up this vault, separated by spaces:
            </p>

            <textarea
              rows={3}
              value={recoveryInput}
              onChange={(e) => setRecoveryInput(e.target.value)}
              placeholder="e.g. abandon ability able about above absent absorb abstract absurd abuse access accident"
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 font-mono text-xs focus:outline-none focus:border-indigo-500 mb-3 resize-none"
            />

            <label className="block text-xs font-semibold text-slate-300 mb-1">Set New PIN (4-6 digits)</label>
            <input
              type="password"
              maxLength={6}
              value={recoveryNewPin}
              onChange={(e) => setRecoveryNewPin(e.target.value.replace(/\D/g, ''))}
              placeholder="Enter new PIN"
              className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 font-mono text-sm tracking-widest text-center focus:outline-none focus:border-indigo-500 mb-4"
            />

            {errorMsg && (
              <div className="text-rose-400 text-xs bg-rose-950/40 border border-rose-900/50 p-2 rounded-lg mb-3">
                {errorMsg}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowRecoveryModal(false);
                  setErrorMsg('');
                }}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-xs font-medium hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isVerifying}
                onClick={handleRecoverySubmit}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-1.5"
              >
                {isVerifying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                <span>Recover & Reset PIN</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
