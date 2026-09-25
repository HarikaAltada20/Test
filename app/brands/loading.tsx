import { PageLoadingSpinner } from "@/components/loading/LoadingSpinner";

export default function BrandsLoading() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-black">
      <PageLoadingSpinner mode="dark" />
    </div>
  );
}
