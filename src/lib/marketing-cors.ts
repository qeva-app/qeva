const ALLOWED_ORIGINS = new Set([
  'https://qeva.in',
  'https://www.qeva.in',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
]);

export function marketingCorsHeaders(origin: string | null): HeadersInit {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://qeva.in';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}
