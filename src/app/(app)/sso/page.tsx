import Link from 'next/link';
import SSOConfiguration from '@/components/SSOConfiguration';
import { hasEnterpriseFeature } from '@/lib/edition';

export default function SSOPage() {
  if (!hasEnterpriseFeature('sso')) {
    return (
      <div className="mx-auto max-w-lg space-y-3 py-16 text-center">
        <h1 className="text-2xl font-bold text-foreground">SSO is Enterprise</h1>
        <p className="text-muted-foreground">
          Azure AD, Google, and Okta sign-in ship with Qeva Enterprise (self-host license or
          managed). Community edition uses email and password.
        </p>
        <p className="text-sm text-muted-foreground">
          <Link href="/docs/self-hosting" className="text-primary underline-offset-4 hover:underline">
            Self-hosting docs
          </Link>
          {' · '}
          <a href="https://qeva.in" className="text-primary underline-offset-4 hover:underline">
            qeva.in
          </a>
        </p>
      </div>
    );
  }

  return <SSOConfiguration />;
}
