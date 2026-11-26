'use client';

import { useState } from 'react';
import { MessageSquare, Send, Star } from 'lucide-react';
import { toast } from 'sonner';

interface DocFeedbackWidgetProps {
  page?: string;
  pageId?: string;
  pageTitle?: string;
}

export default function DocFeedbackWidget({ page, pageId, pageTitle }: DocFeedbackWidgetProps) {
  const effectivePage = page || pageId || pageTitle || 'unknown';
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!rating) return;

    try {
      await fetch('/api/feedback/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'documentation',
          title: `Doc feedback: ${effectivePage}`,
          description: comment || `Rated ${rating}/5`,
          rating,
          page: effectivePage,
        }),
      });
      setSubmitted(true);
      toast.success('Thanks for your feedback!');
    } catch {
      toast.error('Failed to submit feedback');
    }
  };

  if (submitted) {
    return (
      <div className="mt-8 p-4 bg-success/10 border border-green-200 rounded-xl text-center">
        <p className="text-sm text-green-700 font-medium">Thank you for your feedback!</p>
      </div>
    );
  }

  return (
    <div className="mt-8 p-5 bg-background border border-border rounded-xl">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare size={18} className="text-muted-foreground" />
        <h4 className="font-medium text-foreground">Was this page helpful?</h4>
      </div>

      <div className="flex items-center gap-1 mb-3">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => setRating(n)} className="p-0.5">
            <Star size={22} className={n <= rating ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'} />
          </button>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Additional comments (optional)"
        className="textarea mb-3"
        rows={2}
      />

      <button onClick={handleSubmit} disabled={!rating} className="btn-primary btn-sm">
        <Send size={14} />
        Submit
      </button>
    </div>
  );
}
