import { PageLoadingSpinner } from "@/components/loading/LoadingSpinner";

export default function AdminContestsLoading() {
  return (
    <div className="flex h-[76vh] w-full items-center justify-center">
      <PageLoadingSpinner mode="light" />
    </div>
  );
}
