'use client';

import { useState } from 'react';
import { Upload, Lock, HelpCircle } from 'lucide-react';
import AnimatedCard from '@/components/AnimatedCard';
import { toast } from 'sonner';
import { unlockClientVault } from '@/lib/client-vault-crypto';

export default function EncryptionRecovery() {
  const [file, setFile] = useState<File | null>(null);
  const [masterPassword, setMasterPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleRecover = async () => {
    if (!file || !masterPassword) {
      toast.error('Both recovery file and master password are required');
      return;
    }

    setLoading(true);
    try {
      const recoveryData = JSON.parse(await file.text());
      const { encryptedDEK, salt, dekHash } = recoveryData;
      if (!encryptedDEK || !salt) throw new Error('Invalid recovery file');

      const proof = await unlockClientVault({
        masterPassword,
        salt,
        encryptedDEK,
        dekHash,
      });

      const res = await fetch('/api/encryption/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encryptedDEK, salt, dekHash: proof }),
      });

      if (res.ok) {
        setSuccess(true);
        toast.success('Encryption recovered successfully');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Recovery failed');
      }
    } catch {
      toast.error('Invalid recovery file or master password');
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="max-w-lg mx-auto">
        <AnimatedCard className="p-8 text-center">
          <h2 className="text-lg font-semibold text-foreground mb-2">Recovery Successful</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Your vault is unlocked on this device. You can access your credentials.
          </p>
          <a href="/vault" className="btn-primary">
            Go to Vault
          </a>
        </AnimatedCard>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Encryption Recovery</h1>
        <p className="text-muted-foreground text-sm mt-1">Restore access to your encrypted vault</p>
      </div>

      <AnimatedCard className="p-6">
        <div className="space-y-4">
          <div>
            <label className="label">Recovery File</label>
            <div
              className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-blue-400 transition-colors cursor-pointer"
              onClick={() => document.getElementById('recovery-file')?.click()}
            >
              <input
                id="recovery-file"
                type="file"
                accept=".json"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              <Upload size={24} className="mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {file ? file.name : 'Click to upload recovery file'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">qeva-recovery.json</p>
            </div>
          </div>

          <div>
            <label className="label">Master Password</label>
            <input
              type="password"
              value={masterPassword}
              onChange={(e) => setMasterPassword(e.target.value)}
              className="input"
              placeholder="Your original master password"
            />
          </div>

          <button
            onClick={handleRecover}
            disabled={loading || !file || !masterPassword}
            className="btn-primary w-full"
          >
            <Lock size={16} /> {loading ? 'Recovering...' : 'Recover Encryption'}
          </button>
        </div>
      </AnimatedCard>

      <AnimatedCard delay={0.1} className="p-5">
        <div className="flex items-start gap-3">
          <HelpCircle size={20} className="text-primary shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-foreground mb-2">How Recovery Works</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Your recovery file contains your encrypted Data Encryption Key (DEK)</li>
              <li>• The master password unlocks the DEK in your browser only</li>
              <li>• The server never receives your master password during recovery</li>
              <li>• If you&apos;ve lost both your master password and recovery file, data cannot be recovered</li>
            </ul>
          </div>
        </div>
      </AnimatedCard>
    </div>
  );
}
