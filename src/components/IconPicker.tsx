'use client';

import { useState, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

const POPULAR_ICONS = [
  'Lock', 'Key', 'Shield', 'Globe', 'Mail', 'Server', 'Database', 'Cloud',
  'Code', 'Terminal', 'Folder', 'File', 'Image', 'Video', 'Music', 'Camera',
  'Wifi', 'Smartphone', 'Monitor', 'Laptop', 'Cpu', 'HardDrive', 'Settings',
  'User', 'Users', 'CreditCard', 'Wallet', 'ShoppingCart', 'Package', 'Box',
  'Github', 'Chrome', 'Twitter', 'Linkedin', 'Facebook', 'Instagram',
  'Slack', 'MessageSquare', 'Phone', 'Bookmark', 'Star', 'Heart', 'Zap',
  'Award', 'Gift', 'Calendar', 'Clock', 'Map', 'Navigation', 'Home',
];

interface IconPickerProps {
  value: string;
  onChange: (iconName: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function IconPicker({ value, onChange, isOpen, onClose }: IconPickerProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return POPULAR_ICONS;
    return POPULAR_ICONS.filter((name) =>
      name.toLowerCase().includes(search.toLowerCase())
    );
  }, [search]);

  if (!isOpen) return null;

  return (
    <div className="motion-overlay-in fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="motion-panel-in bg-card rounded-xl shadow-lg w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Choose Icon</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="p-4">
          <div className="relative mb-4">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search icons..."
              className="input pl-9"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-8 gap-2 max-h-64 overflow-y-auto scrollbar-thin p-1">
            {filtered.map((name) => {
              const Icon = (LucideIcons as any)[name];
              if (!Icon) return null;
              return (
                <button
                  key={name}
                  onClick={() => {
                    onChange(name);
                    onClose();
                  }}
                  className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
                    value === name
                      ? 'bg-primary/10 text-primary ring-2 ring-blue-500'
                      : 'hover:bg-accent text-muted-foreground'
                  }`}
                  title={name}
                >
                  <Icon size={20} />
                </button>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-6">No icons found</p>
          )}
        </div>
      </div>
    </div>
  );
}
