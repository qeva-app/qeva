'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Copy, Edit, Trash2, Eye, EyeOff, Globe, Lock, ExternalLink,
  KeyRound, Users, Star, RefreshCw, Link2, Plus, MoreHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';
import { copyWithAutoClear, toastCopied } from '@/lib/clipboard';
import { fetchPasswordSecret } from '@/lib/fetch-password-secret';
import { cn } from '@/lib/utils';
import { classifyExpiry } from '@/lib/rotation';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';

interface Password {
  id: string;
  title: string;
  username?: string | null;
  decryptedPassword?: string;
  website?: string | null;
  category?: string | null;
  strength?: number;
  isFavorite?: boolean;
  isGlobal?: boolean;
  isTeam?: boolean;
  color?: string | null;
  createdAt?: string;
  expiryDate?: string | null;
  userId?: string;
  team?: { name: string } | null;
  permissions?: {
    canEdit?: boolean;
    canDelete?: boolean;
    canFavorite?: boolean;
  };
}

interface PasswordListProps {
  passwords: Password[];
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onFavorite?: (id: string, next: boolean) => void;
  onRotate?: (id: string) => void;
  onShare?: (id: string, title: string) => void;
  onAdd?: () => void;
  expiryWarningDays?: number;
  showActions?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  highlightId?: string | null;
}

function StrengthBar({ score }: { score: number }) {
  const color =
    score >= 80 ? 'bg-success' :
    score >= 60 ? 'bg-primary' :
    score >= 40 ? 'bg-warning' : 'bg-destructive';
  return (
    <div
      className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-border sm:block"
      title={`Strength ${score}`}
      aria-label={`Strength ${score} of 100`}
    >
      <div className={cn('h-full rounded-full', color)} style={{ width: `${score}%` }} />
    </div>
  );
}

function TypeBadge({
  isGlobal,
  isTeam,
  teamName,
}: {
  isGlobal?: boolean;
  isTeam?: boolean;
  teamName?: string;
}) {
  if (isGlobal) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
        <Globe size={10} aria-hidden="true" /> Global
      </span>
    );
  }
  if (isTeam) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">
        <Users size={10} aria-hidden="true" /> {teamName || 'Team'}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
      <Lock size={10} aria-hidden="true" /> Personal
    </span>
  );
}

export default function PasswordList({
  passwords,
  onEdit,
  onDelete,
  onFavorite,
  onRotate,
  onShare,
  onAdd,
  expiryWarningDays = 14,
  showActions = true,
  emptyTitle = 'No passwords yet',
  emptyDescription = 'Add a credential to start filling your vault.',
  highlightId = null,
}: PasswordListProps) {
  const [revealedPasswords, setRevealedPasswords] = useState<Set<string>>(new Set());
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [favoriting, setFavoriting] = useState<Set<string>>(new Set());
  const [loadingSecret, setLoadingSecret] = useState<Set<string>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [sheetPw, setSheetPw] = useState<Password | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const ensureSecret = async (id: string, fallback?: string) => {
    if (secrets[id]) return secrets[id];
    if (fallback) {
      setSecrets((prev) => ({ ...prev, [id]: fallback }));
      return fallback;
    }
    setLoadingSecret((prev) => new Set(prev).add(id));
    try {
      const { password } = await fetchPasswordSecret(id);
      setSecrets((prev) => ({ ...prev, [id]: password }));
      return password;
    } finally {
      setLoadingSecret((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const toggleReveal = useCallback(async (pw: Password) => {
    const id = pw.id;
    if (revealedPasswords.has(id)) {
      setRevealedPasswords((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      return;
    }
    try {
      await ensureSecret(id, pw.decryptedPassword || undefined);
      setRevealedPasswords((prev) => new Set(prev).add(id));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to reveal password');
    }
  }, [revealedPasswords]); // eslint-disable-line react-hooks/exhaustive-deps

  const copy = async (text: string, label: string, secret = false) => {
    try {
      if (secret) await copyWithAutoClear(text);
      else await navigator.clipboard.writeText(text);
      toastCopied(label, { secret });
    } catch {
      toast.error('Failed to copy');
    }
  };

  const copyPassword = useCallback(async (pw: Password) => {
    try {
      const secret = await ensureSecret(pw.id, pw.decryptedPassword || undefined);
      if (!secret) {
        toast.error('Password unavailable');
        return;
      }
      await copy(secret, 'Password', true);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to copy');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const copyLogin = async (pw: Password) => {
    try {
      const secret = await ensureSecret(pw.id, pw.decryptedPassword || undefined);
      if (!secret) {
        toast.error('Password unavailable');
        return;
      }
      const text = pw.username ? `${pw.username}\n${secret}` : secret;
      await copyWithAutoClear(text);
      toastCopied(pw.username ? 'Username & password' : 'Password', { secret: true });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to copy');
    }
  };

  const toggleFavorite = async (pw: Password) => {
    if (!pw.permissions?.canFavorite || favoriting.has(pw.id)) return;
    setFavoriting((prev) => new Set(prev).add(pw.id));
    try {
      const res = await fetch(`/api/passwords/${pw.id}/favorite`, { method: 'POST' });
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      onFavorite?.(pw.id, !!data.isFavorite);
      toast.success(data.isFavorite ? 'Added to favorites' : 'Removed from favorites');
    } catch {
      toast.error('Failed to update favorite');
    } finally {
      setFavoriting((prev) => {
        const next = new Set(prev);
        next.delete(pw.id);
        return next;
      });
    }
  };

  useEffect(() => {
    if (highlightId) {
      const idx = passwords.findIndex((p) => p.id === highlightId);
      if (idx >= 0) setFocusedIndex(idx);
    }
  }, [highlightId, passwords]);

  const onListKeyDown = (e: React.KeyboardEvent) => {
    if (!passwords.length) return;
    const pw = passwords[focusedIndex];
    if (!pw) return;
    if ((e.target as HTMLElement).tagName === 'INPUT') return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((i) => Math.min(i + 1, passwords.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'c' || e.key === 'C') {
      e.preventDefault();
      void copyPassword(pw);
    } else if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      void toggleReveal(pw);
    } else if (e.key === 'e' || e.key === 'E') {
      if (onEdit && (pw.permissions?.canEdit ?? true)) {
        e.preventDefault();
        onEdit(pw.id);
      }
    } else if (e.key === 'l' || e.key === 'L') {
      e.preventDefault();
      void copyLogin(pw);
    }
  };

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-pw-index="${focusedIndex}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest' });
  }, [focusedIndex]);

  if (passwords.length === 0) {
    return (
      <EmptyState title={emptyTitle} description={emptyDescription}>
        {onAdd && (
          <Button size="sm" className="mt-4" onClick={onAdd}>
            <Plus size={14} className="mr-1" aria-hidden="true" />
            Add Password
          </Button>
        )}
      </EmptyState>
    );
  }

  const sheetCanEdit = sheetPw && showActions && (sheetPw.permissions?.canEdit ?? !!onEdit);
  const sheetCanDelete = sheetPw && showActions && (sheetPw.permissions?.canDelete ?? !!onDelete);
  const sheetCanFavorite = sheetPw && showActions && sheetPw.permissions?.canFavorite;

  return (
    <>
      <div
        ref={listRef}
        className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
        tabIndex={0}
        role="listbox"
        aria-label="Passwords"
        onKeyDown={onListKeyDown}
      >
        <p className="sr-only">Use arrow keys to move. C copies password, L copies login, R reveals, E edits.</p>
        {passwords.map((pw, index) => {
          const isRevealed = revealedPasswords.has(pw.id);
          const str = pw.strength || 0;
          const canEdit = showActions && (pw.permissions?.canEdit ?? !!onEdit);
          const canDelete = showActions && (pw.permissions?.canDelete ?? !!onDelete);
          const canFavorite = showActions && pw.permissions?.canFavorite;
          const expiry = classifyExpiry(pw.expiryDate, { expiryWarningDays });
          const isFocused = index === focusedIndex;

          return (
            <div
              key={pw.id}
              id={`pw-${pw.id}`}
              data-pw-index={index}
              role="option"
              aria-selected={isFocused}
              onClick={() => setFocusedIndex(index)}
              className={cn(
                'group flex items-center gap-3 border-b border-border/60 px-3 py-2.5 last:border-b-0 transition-colors',
                isFocused ? 'bg-accent/60' : 'hover:bg-muted/40',
                highlightId === pw.id && 'motion-highlight ring-inset ring-2 ring-primary/35'
              )}
              style={pw.color ? { boxShadow: `inset 3px 0 0 ${pw.color}` } : undefined}
            >
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <h3 className="truncate text-sm font-semibold text-foreground">{pw.title}</h3>
                  <TypeBadge isGlobal={pw.isGlobal} isTeam={pw.isTeam} teamName={pw.team?.name} />
                  {expiry === 'expired' && (
                    <span className="rounded-md bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                      Expired
                    </span>
                  )}
                  {expiry === 'expiring' && (
                    <span className="rounded-md bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                      Expiring
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  {pw.username && (
                    <button
                      type="button"
                      className="truncate hover:text-foreground"
                      onClick={() => copy(pw.username!, 'Username')}
                      title="Copy username"
                    >
                      {pw.username}
                    </button>
                  )}
                  <span className="inline-flex items-center gap-1 font-mono tracking-wider">
                    {isRevealed && (secrets[pw.id] || pw.decryptedPassword) ? (
                      <span className="motion-fade select-all text-foreground">
                        {secrets[pw.id] || pw.decryptedPassword}
                      </span>
                    ) : (
                      <span>{loadingSecret.has(pw.id) ? '…' : '••••••••'}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleReveal(pw)}
                      className="rounded p-0.5 text-muted-foreground/70 hover:text-foreground"
                      aria-label={isRevealed ? 'Hide password' : 'Show password'}
                      disabled={loadingSecret.has(pw.id)}
                    >
                      {isRevealed ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => copyPassword(pw)}
                      className="rounded p-0.5 text-muted-foreground/70 hover:text-foreground"
                      aria-label="Copy password"
                      disabled={loadingSecret.has(pw.id)}
                    >
                      <Copy size={12} />
                    </button>
                  </span>
                  {pw.website && (
                    <a
                      href={pw.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-[160px] items-center gap-1 truncate text-primary hover:underline"
                    >
                      <ExternalLink size={11} aria-hidden="true" />
                      {pw.website.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                </div>
              </div>

              <StrengthBar score={str} />

              {/* Desktop actions */}
              <div className="hidden shrink-0 items-center gap-0.5 opacity-70 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 sm:flex">
                <button
                  type="button"
                  onClick={() => copyLogin(pw)}
                  className="rounded p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                  aria-label={`Copy login for ${pw.title}`}
                  title="Copy username & password"
                >
                  <Copy size={14} />
                </button>
                {canFavorite && (
                  <button
                    type="button"
                    onClick={() => toggleFavorite(pw)}
                    className={cn(
                      'rounded p-1.5 transition-colors',
                      pw.isFavorite ? 'text-warning' : 'text-muted-foreground hover:text-warning'
                    )}
                    aria-label={pw.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    aria-pressed={!!pw.isFavorite}
                  >
                    <Star size={14} fill={pw.isFavorite ? 'currentColor' : 'none'} />
                  </button>
                )}
                {showActions && onShare && (
                  <button
                    type="button"
                    onClick={() => onShare(pw.id, pw.title)}
                    className="rounded p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                    aria-label={`Share ${pw.title}`}
                  >
                    <Link2 size={14} />
                  </button>
                )}
                {canEdit && onRotate && (
                  <button
                    type="button"
                    onClick={() => onRotate(pw.id)}
                    className="rounded p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                    aria-label={`Rotate ${pw.title}`}
                  >
                    <RefreshCw size={14} />
                  </button>
                )}
                {canEdit && onEdit && (
                  <button
                    type="button"
                    onClick={() => onEdit(pw.id)}
                    className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                    aria-label={`Edit ${pw.title}`}
                  >
                    <Edit size={14} />
                  </button>
                )}
                {canDelete && onDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(pw.id)}
                    className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Delete ${pw.title}`}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              {/* Mobile: open action sheet */}
              <button
                type="button"
                className="rounded p-1.5 text-muted-foreground hover:bg-accent sm:hidden"
                aria-label={`Actions for ${pw.title}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setSheetPw(pw);
                }}
              >
                <MoreHorizontal size={18} />
              </button>
            </div>
          );
        })}
      </div>

      <Sheet open={!!sheetPw} onOpenChange={(open) => !open && setSheetPw(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
          {sheetPw && (
            <>
              <SheetHeader className="text-left">
                <SheetTitle className="truncate">{sheetPw.title}</SheetTitle>
                <SheetDescription className="truncate">
                  {sheetPw.username || 'No username'}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4 grid gap-1">
                <SheetAction
                  icon={<Copy size={16} />}
                  label="Copy password"
                  onClick={async () => {
                    await copyPassword(sheetPw);
                    setSheetPw(null);
                  }}
                />
                <SheetAction
                  icon={<Copy size={16} />}
                  label="Copy username & password"
                  onClick={async () => {
                    await copyLogin(sheetPw);
                    setSheetPw(null);
                  }}
                />
                <SheetAction
                  icon={revealedPasswords.has(sheetPw.id) ? <EyeOff size={16} /> : <Eye size={16} />}
                  label={revealedPasswords.has(sheetPw.id) ? 'Hide password' : 'Reveal password'}
                  onClick={async () => {
                    await toggleReveal(sheetPw);
                  }}
                />
                {sheetCanFavorite && (
                  <SheetAction
                    icon={<Star size={16} />}
                    label={sheetPw.isFavorite ? 'Remove favorite' : 'Add to favorites'}
                    onClick={async () => {
                      await toggleFavorite(sheetPw);
                      setSheetPw(null);
                    }}
                  />
                )}
                {showActions && onShare && (
                  <SheetAction
                    icon={<Link2 size={16} />}
                    label="Share link"
                    onClick={() => {
                      onShare(sheetPw.id, sheetPw.title);
                      setSheetPw(null);
                    }}
                  />
                )}
                {sheetCanEdit && onRotate && (
                  <SheetAction
                    icon={<RefreshCw size={16} />}
                    label="Rotate password"
                    onClick={() => {
                      onRotate(sheetPw.id);
                      setSheetPw(null);
                    }}
                  />
                )}
                {sheetCanEdit && onEdit && (
                  <SheetAction
                    icon={<Edit size={16} />}
                    label="Edit"
                    onClick={() => {
                      onEdit(sheetPw.id);
                      setSheetPw(null);
                    }}
                  />
                )}
                {sheetCanDelete && onDelete && (
                  <SheetAction
                    icon={<Trash2 size={16} />}
                    label="Delete"
                    destructive
                    onClick={() => {
                      onDelete(sheetPw.id);
                      setSheetPw(null);
                    }}
                  />
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function SheetAction({
  icon,
  label,
  onClick,
  destructive,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium transition-colors hover:bg-muted',
        destructive && 'text-destructive hover:bg-destructive/10'
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border px-6 py-14 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
        <KeyRound size={24} className="text-muted-foreground/50" aria-hidden="true" />
      </div>
      <p className="font-medium text-foreground">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {children}
    </div>
  );
}
