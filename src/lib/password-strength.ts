interface StrengthResult {
  score: number; // 0-100
  label: string;
  feedback: string[];
  suggestions: string[];
}

const COMMON_PATTERNS = [
  /^(password|passwd|pass|pwd)/i,
  /^(admin|root|user|login)/i,
  /^(qwerty|asdf|zxcv)/i,
  /^(123|abc|111|000)/i,
  /^(letmein|welcome|monkey|dragon)/i,
];

export function calculatePasswordStrength(password: string): StrengthResult {
  let score = 0;
  const feedback: string[] = [];
  const suggestions: string[] = [];

  if (!password) {
    return { score: 0, label: 'None', feedback: ['No password provided'], suggestions: ['Enter a password'] };
  }

  const len = password.length;

  // Length scoring (max 30)
  if (len >= 16) score += 30;
  else if (len >= 12) score += 25;
  else if (len >= 10) score += 20;
  else if (len >= 8) score += 10;
  else {
    score += 5;
    feedback.push('Password is too short');
    suggestions.push('Use at least 12 characters');
  }

  // Character variety (max 40)
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumbers = /[0-9]/.test(password);
  const hasSymbols = /[^A-Za-z0-9]/.test(password);

  const variety = [hasUpper, hasLower, hasNumbers, hasSymbols].filter(Boolean).length;
  score += variety * 10;

  if (!hasUpper) suggestions.push('Add uppercase letters');
  if (!hasLower) suggestions.push('Add lowercase letters');
  if (!hasNumbers) suggestions.push('Add numbers');
  if (!hasSymbols) suggestions.push('Add special characters');

  // Uniqueness (max 20)
  const uniqueChars = new Set(password).size;
  const uniqueRatio = uniqueChars / len;
  if (uniqueRatio > 0.7) score += 20;
  else if (uniqueRatio > 0.5) score += 15;
  else if (uniqueRatio > 0.3) score += 10;
  else {
    score += 5;
    feedback.push('Too many repeated characters');
    suggestions.push('Use more diverse characters');
  }

  // Pattern penalties (max -30)
  for (const pattern of COMMON_PATTERNS) {
    if (pattern.test(password)) {
      score -= 15;
      feedback.push('Contains a common pattern');
      suggestions.push('Avoid common words and patterns');
      break;
    }
  }

  // Sequential penalty
  let sequentialCount = 0;
  for (let i = 1; i < password.length; i++) {
    if (Math.abs(password.charCodeAt(i) - password.charCodeAt(i - 1)) === 1) {
      sequentialCount++;
    }
  }
  if (sequentialCount > 2) {
    score -= 10;
    feedback.push('Contains sequential characters');
    suggestions.push('Avoid sequential characters like abc or 123');
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  // Label
  let label: string;
  if (score >= 80) label = 'Very Strong';
  else if (score >= 60) label = 'Strong';
  else if (score >= 40) label = 'Medium';
  else if (score >= 20) label = 'Weak';
  else label = 'Very Weak';

  if (feedback.length === 0) feedback.push('Password meets security requirements');

  return { score, label, feedback, suggestions };
}
