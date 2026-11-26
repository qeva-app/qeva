'use client';

import { useState } from 'react';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useEncryption } from '@/contexts/EncryptionContext';

interface MasterPasswordPromptProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function MasterPasswordPrompt({ isOpen, onClose, onSuccess }: MasterPasswordPromptProps) {
  const { unlock } = useEncryption();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setLoading(true);
    setError('');

    const success = await unlock(password);
    setLoading(false);

    if (success) {
      setPassword('');
      onSuccess?.();
      onClose();
    } else {
      setError('Invalid master password');
    }
  };

  return (
    <div className="motion-overlay-in fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="motion-panel-in bg-card rounded-xl shadow-lg w-full max-w-md mx-4 p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-foreground">Unlock Vault</h2>
          <p className="text-sm text-muted-foreground">Enter your master password to access encrypted data</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="label">Master Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={error ? 'input-error pr-10' : 'input pr-10'}
                placeholder="Enter your master password"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {error && (
              <p className="mt-1.5 text-sm text-destructive flex items-center gap-1">
                <AlertCircle size={14} /> {error}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={loading || !password.trim()} className="btn-primary">
              {loading ? 'Unlocking...' : 'Unlock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
