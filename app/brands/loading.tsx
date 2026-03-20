import { PageLoadingSpinner } from "@/components/loading/LoadingSpinner";

export default function BrandsLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-[#000825]">
      <PageLoadingSpinner mode="dark" />
    </div>
  );
}
