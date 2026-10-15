import type { Metadata } from "next";
import { CreatorProfilePage } from "@/components/campaign-access/CreatorProfilePage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Creator profile",
  robots: { index: false, follow: false },
};

/** Admin view of a creator on one campaign, with what's hidden from the brand marked. */
export default async function AdminCreatorProfilePage({
  params,
}: {
  params: Promise<{ id: string; userId: string }>;
}) {
  const { id, userId } = await params;
  return (
    <CreatorProfilePage
      contestId={id}
      userId={userId}
      campaignPath={`/dashboard/admin/contests/${id}`}
    />
  );
}
