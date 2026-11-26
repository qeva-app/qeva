import { redirect } from 'next/navigation';

/** Legacy route — workflows live at /workflows */
export default function OnboardingPage({
  searchParams,
}: {
  searchParams: { workflow?: string };
}) {
  const q = searchParams.workflow
    ? `?workflow=${encodeURIComponent(searchParams.workflow)}`
    : '';
  redirect(`/workflows${q}`);
}
