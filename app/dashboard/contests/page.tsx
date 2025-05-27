import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ContestListClient } from "./ContestListClient";

export default async function ContestsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.log("ContestsPage: No session found, redirecting to signin.");
    redirect("/auth/signin");
  }

  const { data: userData } = await supabase
    .from("users")
    .select("user_type")
    .eq("id", user.id)
    .single();

  if (userData?.user_type === "creator") {
    redirect("/dashboard/opportunities");
  }

  const { data: contests = [] } = await supabase
    .from("contests_with_status")
    .select("*")
    .eq("advertiser_id", user.id)
    .order("created_at", { ascending: false });

  const typedContests = contests as any[];

  const publishedContests = typedContests.filter((contest) => !contest.is_draft);
  const draftContests = typedContests.filter((contest) => contest.is_draft);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">My Contests</h1>
        <Button className="bg-rose-600 hover:bg-rose-700" asChild>
          <Link href="/dashboard/contests/create?new=true">
            <Plus className="mr-2 h-4 w-4" /> Create Contest
          </Link>
        </Button>
      </div>

      <ContestListClient
        publishedContests={publishedContests}
        draftContests={draftContests}
      />
    </div>
  );
}
