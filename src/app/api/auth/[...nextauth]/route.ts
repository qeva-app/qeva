import { NextRequest } from 'next/server';
import NextAuth from 'next-auth';
import { buildAuthOptions } from '@/lib/auth';

async function handler(req: NextRequest, context: { params: { nextauth: string[] } }) {
  const options = await buildAuthOptions();
  // NextAuth App Router handler - options rebuilt so active Azure AD configs are registered
  return NextAuth(options)(req, context as never);
}

export { handler as GET, handler as POST };
