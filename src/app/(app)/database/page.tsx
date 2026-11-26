import { redirect } from 'next/navigation';

/** Database Explorer UI removed from the product surface for safety. */
export default function DatabasePage() {
  redirect('/');
}
