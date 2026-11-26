'use client';

import { useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface Option {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface EnhancedSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function EnhancedSelect({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  className = '',
  disabled = false,
}: EnhancedSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        disabled={disabled}
        className="input flex items-center justify-between gap-2 text-left"
      >
        <span className={selected ? 'text-foreground' : 'text-muted-foreground'}>
          {selected ? (
            <span className="flex items-center gap-2">
              {selected.icon}
              {selected.label}
            </span>
          ) : (
            placeholder
          )}
        </span>
        <ChevronDown size={16} className={`text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto scrollbar-thin">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-primary/10 transition-colors ${
                option.value === value ? 'bg-primary/10 text-primary font-medium' : 'text-foreground'
              }`}
            >
              {option.icon}
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
