import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function RootPage() {
  const jar = await cookies();
  const hasAuth = jar.has('pp_access_token') || jar.has('pp_refresh_token');

  if (hasAuth) {
    redirect('/inicio');
  } else {
    redirect('/login');
  }
}
