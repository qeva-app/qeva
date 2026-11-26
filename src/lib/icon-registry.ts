import * as LucideIcons from 'lucide-react';

const iconCache = new Map<string, any>();

export function getIcon(name: string): any {
  if (iconCache.has(name)) return iconCache.get(name);

  // Convert kebab-case or lowercase to PascalCase
  const pascalName = name
    .split(/[-_\s]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');

  const icon = (LucideIcons as any)[pascalName] || null;
  iconCache.set(name, icon);
  return icon;
}

export function getIconNames(): string[] {
  return Object.keys(LucideIcons).filter(
    (key) => key !== 'default' && key !== 'createLucideIcon' && typeof (LucideIcons as any)[key] === 'function'
  );
}
