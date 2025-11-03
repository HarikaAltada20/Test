import { PageLoadingSpinner } from "@/components/loading/LoadingSpinner";

export default function AdminLeaderboardLoading() {
  return (
    <div className="flex items-center justify-center h-[76vh]">
      <PageLoadingSpinner mode="light" />
    </div>
  );
}
