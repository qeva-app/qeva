import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { parseImport, processImport, type ImportFormat } from '@/lib/browser-import';
import { encrypt, encryptNotes } from '@/lib/encryption-unified';
import prisma from '@/lib/db';
import { logAudit, AuditActions } from '@/lib/audit';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { data, format, browser, previewOnly } = body;

    if (!data) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 });
    }

    const hint = (browser || format || 'auto') as ImportFormat;
    const parsed = parseImport(data, hint === 'json' || hint === 'csv' ? hint : hint);
    const processed = processImport(parsed.entries, { autoCategory: true, autoTag: true });

    if (previewOnly) {
      return NextResponse.json({
        source: parsed.source,
        total: processed.length,
        errors: parsed.errors,
        preview: processed.slice(0, 20).map((e) => ({
          title: e.title,
          username: e.username,
          url: e.url,
          category: e.category,
          strength: e.strength,
        })),
      });
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [...parsed.errors];

    for (const entry of processed) {
      try {
        const existing = await prisma.passwordEntry.findFirst({
          where: {
            userId: session.user.id,
            title: entry.title,
            username: entry.username,
          },
        });

        if (existing) {
          skipped++;
          continue;
        }

        const encryptedPassword = encrypt(entry.password);

        await prisma.passwordEntry.create({
          data: {
            title: entry.title,
            username: entry.username || '',
            encryptedPassword,
            website: entry.url || '',
            notes: encryptNotes(entry.notes || '') || undefined,
            category: entry.category || undefined,
            tags: entry.tags || undefined,
            strength: entry.strength ?? undefined,
            encryptionType: 'PUBLIC_KEY',
            userId: session.user.id,
          },
        });
        imported++;
      } catch (e: any) {
        errors.push(`Failed to import "${entry.title}": ${e.message}`);
      }
    }

    await logAudit({
      userId: session.user.id,
      action: AuditActions.PASSWORDS_IMPORTED,
      resource: 'password',
      details: { browser, format: parsed.source, total: processed.length, imported, skipped },
      req,
    });

    return NextResponse.json({
      total: processed.length,
      imported,
      skipped,
      source: parsed.source,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Import failed' }, { status: 500 });
  }
}
