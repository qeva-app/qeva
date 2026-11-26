'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Save } from 'lucide-react';
import AnimatedCard from '@/components/AnimatedCard';
import { UserAvatar } from '@/components/UserAvatar';
import { AVATAR_PRESETS } from '@/lib/avatars';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function ProfilePage() {
  const { update } = useSession();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.json())
      .then((d) => {
        setProfile(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
    if (res.ok) toast.success('Profile updated');
    else toast.error('Failed to update');
    setSaving(false);
  };

  const handleAvatar = async (image: string | null) => {
    setSavingAvatar(true);
    const res = await fetch('/api/profile/avatar', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image }),
    });
    if (res.ok) {
      const user = await res.json();
      setProfile((p: any) => ({ ...p, image: user.image }));
      await update({ image: user.image });
      toast.success(image ? 'Avatar updated' : 'Avatar cleared');
    } else {
      toast.error('Failed to update avatar');
    }
    setSavingAvatar(false);
  };

  if (loading || !profile) return <div className="animate-pulse h-96 bg-muted rounded-xl" />;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Profile</h1>

      <AnimatedCard className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <UserAvatar image={profile.image} name={profile.name} className="h-16 w-16" fallbackClassName="text-xl" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">{profile.name}</h2>
            <p className="text-sm text-muted-foreground">{profile.email}</p>
          </div>
        </div>

        <div className="mb-6 space-y-3">
          <p className="label">Avatar</p>
          {(['human', 'animal'] as const).map((kind) => (
            <div key={kind}>
              <p className="mb-1.5 text-xs capitalize text-muted-foreground">{kind}s</p>
              <div className="flex flex-wrap gap-2">
                {AVATAR_PRESETS.filter((a) => a.kind === kind).map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    disabled={savingAvatar}
                    aria-label={a.label}
                    aria-pressed={profile.image === a.id}
                    onClick={() => handleAvatar(a.id)}
                    className={cn(
                      'h-12 w-12 overflow-hidden rounded-full transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      profile.image === a.id
                        ? 'ring-2 ring-ring ring-offset-2 ring-offset-background'
                        : 'hover:opacity-90'
                    )}
                  >
                    <img src={a.id} alt={a.label} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button
            type="button"
            disabled={savingAvatar || !profile.image}
            onClick={() => handleAvatar(null)}
            className="h-9 rounded-full border border-border px-3 text-xs text-muted-foreground hover:bg-accent disabled:opacity-40"
          >
            Clear
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">First Name</label>
            <input
              value={profile.firstName || ''}
              onChange={(e) => setProfile((p: any) => ({ ...p, firstName: e.target.value }))}
              className="input"
            />
          </div>
          <div>
            <label className="label">Last Name</label>
            <input
              value={profile.lastName || ''}
              onChange={(e) => setProfile((p: any) => ({ ...p, lastName: e.target.value }))}
              className="input"
            />
          </div>
          <div>
            <label className="label">Department</label>
            <input
              value={profile.department || ''}
              onChange={(e) => setProfile((p: any) => ({ ...p, department: e.target.value }))}
              className="input"
            />
          </div>
          <div>
            <label className="label">Position</label>
            <input
              value={profile.position || ''}
              onChange={(e) => setProfile((p: any) => ({ ...p, position: e.target.value }))}
              className="input"
            />
          </div>
          <div>
            <label className="label">Phone</label>
            <input
              value={profile.phone || ''}
              onChange={(e) => setProfile((p: any) => ({ ...p, phone: e.target.value }))}
              className="input"
            />
          </div>
          <div>
            <label className="label">Location</label>
            <input
              value={profile.location || ''}
              onChange={(e) => setProfile((p: any) => ({ ...p, location: e.target.value }))}
              className="input"
            />
          </div>
        </div>

        <button onClick={handleSave} disabled={saving} className="btn-primary mt-4">
          <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </AnimatedCard>
    </div>
  );
}
