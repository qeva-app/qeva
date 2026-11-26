import { toast } from 'sonner';

export const CLIPBOARD_CLEAR_MS = 30_000;

let clearTimer: ReturnType<typeof setTimeout> | null = null;
let clearGeneration = 0;

/**
 * Browsers often deny clipboard.readText() outside a user gesture, so a
 * delayed "read then clear" never runs. We try to establish read access in the
 * same gesture as the copy; if that fails, we still clear after the delay when
 * this tab is visible (same tradeoff other password managers make).
 */
async function probeClipboardRead(): Promise<boolean> {
  try {
    await navigator.clipboard.readText();
    return true;
  } catch {
    return false;
  }
}

async function clearClipboard(expected: string, canVerify: boolean): Promise<boolean> {
  try {
    if (canVerify) {
      const current = await navigator.clipboard.readText();
      if (current !== expected) return false;
    } else if (document.visibilityState !== 'visible') {
      // Don't wipe clipboard blindly if the user already left the tab
      return false;
    }
    await navigator.clipboard.writeText('');
    return true;
  } catch {
    return false;
  }
}

/** Copy text and clear the clipboard after a short delay. */
export async function copyWithAutoClear(
  text: string,
  clearAfterMs = CLIPBOARD_CLEAR_MS
): Promise<void> {
  await navigator.clipboard.writeText(text);
  // Same click gesture - improves chance that later verify/clear is allowed
  const canVerify = await probeClipboardRead();

  if (clearTimer) clearTimeout(clearTimer);
  const generation = ++clearGeneration;
  // Best-effort only; never toast about clear - many browsers deny delayed clipboard writes
  clearTimer = setTimeout(async () => {
    if (generation !== clearGeneration) return;
    await clearClipboard(text, canVerify);
  }, clearAfterMs);
}

/** Toast after a copy. Do not promise timed clipboard clear - browsers often block it. */
export function toastCopied(
  label: string,
  _opts?: { secret?: boolean; clearAfterMs?: number }
) {
  toast.success(`${label} copied`);
}
