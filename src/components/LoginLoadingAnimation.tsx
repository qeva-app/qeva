'use client';

/** Plain status overlay — kept for any leftover imports; prefer immediate redirect. */
export default function LoginLoadingAnimation() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background"
    >
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground"
        aria-hidden
      />
      <p className="mt-4 text-sm text-muted-foreground">Signing in…</p>
    </div>
  );
}
