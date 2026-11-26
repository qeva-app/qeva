export type Theme = 'light';

export function getTheme(): Theme {
  return 'light';
}

export function setTheme(_theme: Theme): void {
  // Light theme only - no-op
}
