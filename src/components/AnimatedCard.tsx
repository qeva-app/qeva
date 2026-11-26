import { type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface AnimatedCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Ignored — kept so existing call sites keep compiling. */
  delay?: number;
  className?: string;
}

/** Static card surface. Name kept for call-site compatibility. */
export default function AnimatedCard({ children, delay: _delay, className = '', ...props }: AnimatedCardProps) {
  return (
    <div className={cn('card', className)} {...props}>
      {children}
    </div>
  );
}
