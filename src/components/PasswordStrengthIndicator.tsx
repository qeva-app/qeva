'use client';

interface PasswordStrengthIndicatorProps {
  score: number;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export default function PasswordStrengthIndicator({ score, showLabel = true, size = 'md' }: PasswordStrengthIndicatorProps) {
  const getColor = () => {
    if (score >= 80) return 'bg-success/100';
    if (score >= 60) return 'bg-primary';
    if (score >= 40) return 'bg-amber-500';
    if (score >= 20) return 'bg-orange-500';
    return 'bg-destructive/100';
  };

  const getLabel = () => {
    if (score >= 80) return 'Very Strong';
    if (score >= 60) return 'Strong';
    if (score >= 40) return 'Medium';
    if (score >= 20) return 'Weak';
    return 'Very Weak';
  };

  const getTextColor = () => {
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-primary';
    if (score >= 40) return 'text-warning';
    if (score >= 20) return 'text-orange-600';
    return 'text-destructive';
  };

  const height = size === 'sm' ? 'h-1.5' : 'h-2.5';

  return (
    <div className="w-full">
      <div className={`w-full bg-muted rounded-full ${height} overflow-hidden`}>
        <div
          className={`${height} rounded-full transition-[width,background-color] duration-500 ${getColor()}`}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between mt-1">
          <span className={`text-xs font-medium ${getTextColor()}`}>{getLabel()}</span>
          <span className="text-xs text-muted-foreground">{score}/100</span>
        </div>
      )}
    </div>
  );
}
