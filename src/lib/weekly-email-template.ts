import { getSecurityQuote } from './security-quotes';

interface WeeklyStats {
  totalPasswords: number;
  newPasswords: number;
  updatedPasswords: number;
  loginCount: number;
  avgSessionDuration: number; // seconds
  securityScore: number;
  weakPasswords: number;
  engagementLevel: string;
}

function getEngagementBadge(level: string): string {
  const badges: Record<string, string> = {
    high: '🏆 Power User',
    medium: '⭐ Active User',
    low: '💤 Getting Started',
  };
  return badges[level] || '⭐ Active User';
}

export function getWeeklyEmailTemplate(
  userName: string,
  stats: WeeklyStats
): string {
  const quote = getSecurityQuote();
  const badge = getEngagementBadge(stats.engagementLevel);
  const avgMinutes = Math.round(stats.avgSessionDuration / 60);

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0; padding:0; background-color:#f1f5f9; font-family:'Inter',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9; padding:40px 20px;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
            <tr>
              <td style="background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); padding:32px; text-align:center;">
                <h1 style="color:#ffffff; margin:0; font-size:28px;">🔐 Qeva Weekly Summary</h1>
                <p style="color:#93c5fd; margin:8px 0 0; font-size:14px;">Your security report for this week</p>
              </td>
            </tr>
            <tr><td style="padding:32px;">
              <p style="color:#1e293b; font-size:16px; margin:0 0 8px;">Hello <strong>${userName}</strong>! ${badge}</p>
              <p style="color:#64748b; font-size:14px; margin:0 0 24px;">Here&rsquo;s your weekly security overview:</p>

              <table width="100%" cellpadding="12" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="background:#eff6ff; border-radius:8px; text-align:center; width:25%;">
                    <div style="font-size:24px; font-weight:700; color:#1e3a5f;">${stats.totalPasswords}</div>
                    <div style="font-size:11px; color:#64748b;">Total Passwords</div>
                  </td>
                  <td style="background:#f0fdf4; border-radius:8px; text-align:center; width:25%;">
                    <div style="font-size:24px; font-weight:700; color:#166534;">${stats.securityScore}%</div>
                    <div style="font-size:11px; color:#64748b;">Security Score</div>
                  </td>
                  <td style="background:#fffbeb; border-radius:8px; text-align:center; width:25%;">
                    <div style="font-size:24px; font-weight:700; color:#92400e;">${stats.loginCount}</div>
                    <div style="font-size:11px; color:#64748b;">Logins</div>
                  </td>
                  <td style="background:#fef2f2; border-radius:8px; text-align:center; width:25%;">
                    <div style="font-size:24px; font-weight:700; color:#991b1b;">${stats.weakPasswords}</div>
                    <div style="font-size:11px; color:#64748b;">Weak Passwords</div>
                  </td>
                </tr>
              </table>

              <div style="background:#f8fafc; border-left:4px solid #2563eb; padding:16px; border-radius:0 8px 8px 0; margin:0 0 24px;">
                <p style="color:#64748b; margin:0; font-size:13px; font-style:italic;">&ldquo;${quote}&rdquo;</p>
              </div>

              <p style="color:#94a3b8; font-size:12px; margin:0;">Avg session: ${avgMinutes} min &bull; ${stats.newPasswords} new &bull; ${stats.updatedPasswords} updated</p>
            </td></tr>
            <tr>
              <td style="background-color:#f8fafc; padding:20px 32px; text-align:center;">
                <p style="color:#94a3b8; margin:0; font-size:12px;">&copy; ${new Date().getFullYear()} Qeva</p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;
}
