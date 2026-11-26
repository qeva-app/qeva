'use client';

/** Community stub — real UI in qeva-enterprise overlay. */
export default function SSOConfiguration() {
  return (
    <div className="mx-auto max-w-lg space-y-3 py-16 text-center">
      <h1 className="text-2xl font-bold text-foreground">SSO is Enterprise</h1>
      <p className="text-muted-foreground">
        Apply the private qeva-enterprise overlay (or use managed hosting) to enable Azure AD,
        Google, and Okta.
      </p>
    </div>
  );
}

