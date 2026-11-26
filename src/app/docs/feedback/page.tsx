'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import { toast } from 'sonner';
import { DocHeader } from '@/components/docs/ui';

export default function FeedbackPage() {
  const [type, setType] = useState('bug');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/feedback/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, message, page: '/docs/feedback' }),
      });
      if (res.ok) {
        setSubmitted(true);
        toast.success('Feedback submitted!');
      } else {
        toast.error('Failed to submit feedback');
      }
    } catch {
      toast.error('An error occurred');
    }
    setLoading(false);
  };

  if (submitted) {
    return (
      <div className="py-12 text-center">
        <h1 className="font-display text-2xl font-semibold text-foreground">Thank you</h1>
        <p className="mt-2 text-muted-foreground">Your feedback has been submitted.</p>
        <button
          type="button"
          onClick={() => {
            setSubmitted(false);
            setMessage('');
          }}
          className="btn btn-outline mt-6"
        >
          Submit more feedback
        </button>
      </div>
    );
  }

  return (
    <div>
      <DocHeader
        kicker="Help"
        title="Feedback"
        description="Report bugs, request features, or suggest improvements."
      />

      <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
        <div>
          <label className="label" htmlFor="feedback-type">
            Feedback type
          </label>
          <select
            id="feedback-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="select"
          >
            <option value="bug">Bug report</option>
            <option value="feature">Feature request</option>
            <option value="improvement">Improvement</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="label" htmlFor="feedback-message">
            Your feedback
          </label>
          <textarea
            id="feedback-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="textarea"
            rows={6}
            placeholder="Describe your feedback in detail…"
            required
          />
        </div>

        <button type="submit" disabled={loading || !message.trim()} className="btn btn-primary">
          {loading ? 'Submitting…' : 'Submit feedback'} <Send size={16} aria-hidden />
        </button>
      </form>
    </div>
  );
}
