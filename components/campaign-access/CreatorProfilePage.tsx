import { notFound, redirect } from "next/navigation";
import {
  CampaignAccessError,
  getAccessActor,
  getServiceClient,
} from "@/lib/campaign-access-server";
import { isUuid } from "@/lib/campaign-access";
import { loadCampaignCreatorProfile } from "@/lib/campaign-creator-profile-server";
import { CreatorProfileView } from "./CreatorProfileView";

type Props = {
  contestId: string;
  userId: string;
  /** Campaign page the "Back" link returns to (brand or admin route). */
  campaignPath: string;
};

/**
 * Server part of the creator profile page shared by the brand and admin
 * routes. Anything the viewer may not see is a 404, so the page can't be used
 * to check whether a creator or campaign exists.
 */
export async function CreatorProfilePage({ contestId, userId, campaignPath }: Props) {
  if (!isUuid(contestId) || !isUuid(userId)) notFound();

  let data;
  try {
    const actor = await getAccessActor();
    data = await loadCampaignCreatorProfile(getServiceClient(), actor, contestId, userId);
  } catch (err) {
    if (err instanceof CampaignAccessError) {
      if (err.status === 401) redirect("/auth/signin");
      notFound();
    }
    throw err;
  }

  return <CreatorProfileView data={data} campaignPath={campaignPath} />;
}
