import type { Metadata } from "next";
import { CreatorProfilePage } from "@/components/campaign-access/CreatorProfilePage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Creator profile",
  robots: { index: false, follow: false },
};

/** A creator who applied to (or was added to) one of the brand's campaigns. */
export default async function BrandCreatorProfilePage({
  params,
}: {
  params: Promise<{ id: string; userId: string }>;
}) {
  const { id, userId } = await params;
  return <CreatorProfilePage contestId={id} userId={userId} campaignPath={`/dashboard/contests/${id}`} />;
}
