'use client';

import Link from 'next/link';

/** Community stub - full org console ships with Enterprise. */
export default function EnterpriseManagement() {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <h1 className="text-xl font-semibold text-foreground">Enterprise only</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Organization management, company accounts, and related admin tools are part of Qeva
        Enterprise. This Community build is for individual vaults.
      </p>
      <p className="mt-6 text-sm">
        <Link href="/docs/open-core" className="text-primary underline-offset-4 hover:underline">
          Open-core editions
        </Link>
      </p>
    </div>
  );
}
