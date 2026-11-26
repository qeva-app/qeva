'use client';

import { useEffect, useState } from 'react';
import { Copy, Link2, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type ShareLink = {
  id: string;
  shareUrl: string;
  expiresAt: string;
  maxViews: number;
  viewCount: number;
  isActive: boolean;
  expired?: boolean;
  exhausted?: boolean;
};

export default function ShareLinkDialog({
  open,
  onOpenChange,
  passwordId,
  passwordTitle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  passwordId: string | null;
  passwordTitle?: string;
}) {
  const [expiresInHours, setExpiresInHours] = useState('24');
  const [maxViews, setMaxViews] = useState('1');
  const [creating, setCreating] = useState(false);
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);

  const load = () => {
    if (!passwordId) return;
    setLoading(true);
    fetch(`/api/passwords/share?passwordEntryId=${encodeURIComponent(passwordId)}`)
      .then((r) => r.json())
      .then((data) => {
        setLinks(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    if (open && passwordId) {
      setCreatedUrl(null);
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, passwordId]);

  const create = async () => {
    if (!passwordId) return;
    setCreating(true);
    try {
      const res = await fetch('/api/passwords/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passwordEntryId: passwordId,
          expiresInHours: Number(expiresInHours),
          maxViews: Number(maxViews),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to create link');
      } else {
        setCreatedUrl(data.shareUrl);
        toast.success('Share link created');
        load();
      }
    } catch {
      toast.error('Failed to create link');
    }
    setCreating(false);
  };

  const revoke = async (id: string) => {
    const res = await fetch(`/api/passwords/share/${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Link revoked');
      load();
    } else {
      toast.error('Failed to revoke');
    }
  };

  const copyUrl = async (url: string) => {
    await navigator.clipboard.writeText(url);
    toast.success('Link copied');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Link2 size={18} /> Share credential
          </DialogTitle>
          <DialogDescription>
            Create a time-limited, view-capped link for{' '}
            <span className="font-medium text-foreground">{passwordTitle || 'this password'}</span>.
            Recipients do not need a Qeva account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Expires in</label>
              <Select value={expiresInHours} onValueChange={setExpiresInHours}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 hour</SelectItem>
                  <SelectItem value="24">24 hours</SelectItem>
                  <SelectItem value="72">3 days</SelectItem>
                  <SelectItem value="168">7 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="label">Max views</label>
              <Select value={maxViews} onValueChange={setMaxViews}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 5, 10].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {createdUrl && (
            <div className="flex gap-2">
              <Input readOnly value={createdUrl} className="font-mono text-xs" />
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label="Copy share link"
                onClick={() => copyUrl(createdUrl)}
              >
                <Copy size={14} aria-hidden="true" />
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Your links for this item</p>
            {loading ? (
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 size={12} className="animate-spin" /> Loading…
              </p>
            ) : links.length === 0 ? (
              <p className="text-xs text-muted-foreground">No links yet</p>
            ) : (
              <ul className="max-h-40 space-y-2 overflow-y-auto">
                {links.map((l) => {
                  const dead = !l.isActive || l.expired || l.exhausted;
                  return (
                    <li
                      key={l.id}
                      className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/30 px-2 py-1.5 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono">{l.shareUrl.replace(/^https?:\/\//, '')}</p>
                        <p className="text-muted-foreground">
                          {l.viewCount}/{l.maxViews} views ·{' '}
                          {dead
                            ? !l.isActive
                              ? 'Revoked'
                              : l.expired
                                ? 'Expired'
                                : 'Exhausted'
                            : `until ${new Intl.DateTimeFormat(undefined, {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              }).format(new Date(l.expiresAt))}`}
                        </p>
                      </div>
                      {!dead && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          aria-label="Copy share link"
                          onClick={() => copyUrl(l.shareUrl)}
                        >
                          <Copy size={12} aria-hidden="true" />
                        </Button>
                      )}
                      {l.isActive && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          aria-label="Revoke share link"
                          onClick={() => revoke(l.id)}
                        >
                          <Trash2 size={12} aria-hidden="true" />
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button type="button" onClick={create} disabled={creating || !passwordId}>
            {creating ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Link2 size={14} className="mr-1" />}
            Create link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
