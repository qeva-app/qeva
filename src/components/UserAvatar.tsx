'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { avatarSrc } from '@/lib/avatars';
import { cn } from '@/lib/utils';

function initialsFrom(name?: string | null) {
  return (
    name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '??'
  );
}

export function UserAvatar({
  image,
  name,
  className,
  fallbackClassName,
}: {
  image?: string | null;
  name?: string | null;
  className?: string;
  fallbackClassName?: string;
}) {
  const src = avatarSrc(image);
  const initials = initialsFrom(name);

  return (
    <Avatar className={className}>
      {src ? <AvatarImage src={src} alt={name || 'Avatar'} /> : null}
      <AvatarFallback className={cn('bg-primary/10 text-xs font-semibold text-primary', fallbackClassName)}>
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
