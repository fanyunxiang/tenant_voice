import ListingDetailClient from './ListingDetailClient';

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ listingId: string }>;
}) {
  const resolvedParams = await params;
  return <ListingDetailClient listingId={resolvedParams.listingId} />;
}
