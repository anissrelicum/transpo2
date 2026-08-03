import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

// Racine : chaque rôle a son espace (le layout de destination revalide le droit).
export default function Home() {
  const role = cookies().get('role')?.value;
  if (role === 'SUPER_ADMIN') redirect('/saas');
  if (role === 'MERCHANT') redirect('/portail');
  redirect('/dashboard');
}
