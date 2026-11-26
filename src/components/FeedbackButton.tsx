'use client';

import { useState } from 'react';
import { MessageSquare, X, Send, Star } from 'lucide-react';
import { toast } from 'sonner';

export default function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<'bug' | 'feature' | 'documentation' | 'support'>('feature');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [rating, setRating] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/feedback/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          title: title.trim(),
          description: description.trim(),
          rating: rating || undefined,
          page: window.location.pathname,
        }),
      });

      if (res.ok) {
        toast.success('Thanks for your feedback!');
        setTitle('');
        setDescription('');
        setRating(0);
        setOpen(false);
      } else {
        toast.error('Failed to submit feedback');
      }
    } catch {
      toast.error('Failed to submit feedback');
    }
    setLoading(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-md transition-colors hover:bg-primary/90 mb-[env(safe-area-inset-bottom)] mr-[env(safe-area-inset-right)]"
        aria-label="Send feedback"
      >
        <MessageSquare size={20} aria-hidden="true" />
      </button>

      {open && (
        <div className="motion-panel-in fixed bottom-24 right-6 z-50 w-96 rounded-xl border border-border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b border-border p-4">
            <h3 className="font-semibold text-foreground">Send Feedback</h3>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3 p-4">
            <div className="flex flex-wrap gap-2">
              {(['bug', 'feature', 'documentation', 'support'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                    type === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Summary"
              className="input"
              required
            />

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Details (optional)"
              className="textarea"
              rows={3}
            />

            <div className="flex items-center gap-1">
              <span className="mr-2 text-xs text-muted-foreground">Rating:</span>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setRating(n)} className="p-0.5">
                  <Star
                    size={18}
                    className={n <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}
                  />
                </button>
              ))}
            </div>

            <button type="submit" disabled={loading || !title.trim()} className="btn-primary w-full">
              <Send size={16} />
              {loading ? 'Sending...' : 'Send Feedback'}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
