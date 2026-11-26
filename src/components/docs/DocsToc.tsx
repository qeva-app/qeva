'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

type TocItem = { id: string; text: string };

export function DocsToc() {
  const pathname = usePathname();
  const [items, setItems] = useState<TocItem[]>([]);
  const [active, setActive] = useState('');

  useEffect(() => {
    const headings = Array.from(document.querySelectorAll('main .docs-section[id]')) as HTMLElement[];
    const next = headings.map((el) => ({
      id: el.id,
      text: el.querySelector('h2')?.textContent?.trim() || el.id,
    }));
    setItems(next);
    setActive(next[0]?.id ?? '');
    if (!headings.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) setActive(visible[0].target.id);
      },
      { rootMargin: '-18% 0px -70% 0px', threshold: [0, 1] }
    );

    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [pathname]);

  if (items.length < 2) return null;

  return (
    <aside className="hidden w-52 shrink-0 xl:block">
      <div className="sticky top-24 rounded-2xl border border-border bg-card/80 p-4 shadow-sm backdrop-blur">
        <p className="mb-3 text-xs font-medium text-muted-foreground">On this page</p>
        <nav className="space-y-1" aria-label="On this page">
          {items.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={cn(
                'block truncate rounded-md px-2 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active === item.id
                  ? 'bg-primary/10 font-medium text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              {item.text}
            </a>
          ))}
        </nav>
      </div>
    </aside>
  );
}
