/** Built-in profile avatars (self-hosted SVGs) — no uploads / object storage. */
export const AVATAR_PRESETS = [
  { id: '/avatars/human-avery.svg', label: 'Avery', kind: 'human' },
  { id: '/avatars/human-jordan.svg', label: 'Jordan', kind: 'human' },
  { id: '/avatars/human-riley.svg', label: 'Riley', kind: 'human' },
  { id: '/avatars/human-casey.svg', label: 'Casey', kind: 'human' },
  { id: '/avatars/human-morgan.svg', label: 'Morgan', kind: 'human' },
  { id: '/avatars/human-quinn.svg', label: 'Quinn', kind: 'human' },
  { id: '/avatars/human-sage.svg', label: 'Sage', kind: 'human' },
  { id: '/avatars/human-drew.svg', label: 'Drew', kind: 'human' },
  { id: '/avatars/animal-fox.svg', label: 'Fox', kind: 'animal' },
  { id: '/avatars/animal-cat.svg', label: 'Cat', kind: 'animal' },
  { id: '/avatars/animal-dog.svg', label: 'Dog', kind: 'animal' },
  { id: '/avatars/animal-owl.svg', label: 'Owl', kind: 'animal' },
  { id: '/avatars/animal-panda.svg', label: 'Panda', kind: 'animal' },
  { id: '/avatars/animal-bunny.svg', label: 'Bunny', kind: 'animal' },
  { id: '/avatars/animal-bear.svg', label: 'Bear', kind: 'animal' },
  { id: '/avatars/animal-frog.svg', label: 'Frog', kind: 'animal' },
] as const;

export type AvatarPresetId = (typeof AVATAR_PRESETS)[number]['id'];

export function getAvatarPreset(value: string | null | undefined) {
  if (!value) return undefined;
  return AVATAR_PRESETS.find((a) => a.id === value);
}

export function isAvatarPreset(value: string): value is AvatarPresetId {
  return AVATAR_PRESETS.some((a) => a.id === value);
}

/** SSO / OAuth profile photos only — never accept arbitrary client URLs. */
export function isRemoteAvatarUrl(value: string) {
  return /^https:\/\//i.test(value);
}

export function avatarSrc(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  if (isAvatarPreset(value) || isRemoteAvatarUrl(value)) return value;
  return undefined;
}
