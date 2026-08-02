import * as React from 'react';
import { redirect } from 'next/navigation';
import { Box } from '@radix-ui/themes';
import type { ReviewsSummary } from '@transpo/api-client';
import { serverClient } from '../../../lib/server';
import { ReviewsView } from '../../../components/ReviewsView';

export const dynamic = 'force-dynamic';

export default async function ReviewsPage() {
  let data: ReviewsSummary;
  try {
    data = await serverClient().getReviews();
  } catch {
    redirect('/login');
  }
  return (
    <Box style={{ maxWidth: 1300, margin: '0 auto' }}>
      <ReviewsView data={data} />
    </Box>
  );
}
