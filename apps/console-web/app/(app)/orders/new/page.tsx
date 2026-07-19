import * as React from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { CreateWizard } from '../../../../components/CreateWizard';

export const dynamic = 'force-dynamic';

export default function NewOrderPage() {
  const role = cookies().get('role')?.value || '';
  if (!['ADMIN', 'DISPATCHER', 'MERCHANT'].includes(role)) redirect('/orders');
  return <CreateWizard />;
}
