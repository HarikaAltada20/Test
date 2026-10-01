import { PageLoadingSpinner } from "@/components/loading/LoadingSpinner";

export default function PricingLoading() {
  return (
    <div className="min-h-screen w-full bg-black text-white flex items-center justify-center">
      <PageLoadingSpinner mode="dark" />
    </div>
  );
}
