import { PageLoadingSpinner } from "@/components/loading/LoadingSpinner"

export default function OpportunitiesLoading() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="h-8 w-64 bg-muted animate-pulse rounded" />
                <div className="flex gap-2">
                    <div className="h-10 w-32 bg-muted animate-pulse rounded" />
                    <div className="h-10 w-32 bg-muted animate-pulse rounded" />
                </div>
            </div>

            {/* Filter skeleton */}
            <div className="flex gap-4 flex-wrap">
                <div className="h-10 w-40 bg-muted animate-pulse rounded" />
                <div className="h-10 w-40 bg-muted animate-pulse rounded" />
                <div className="h-10 w-40 bg-muted animate-pulse rounded" />
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="border rounded-lg overflow-hidden">
                        {/* Image skeleton */}
                        <div className="h-48 bg-muted animate-pulse" />

                        <div className="p-6 space-y-4">
                            <div className="flex justify-between items-start">
                                <div className="h-5 w-3/4 bg-muted animate-pulse rounded" />
                                <div className="h-6 w-16 bg-muted animate-pulse rounded-full" />
                            </div>

                            <div className="space-y-2">
                                <div className="h-3 w-full bg-muted animate-pulse rounded" />
                                <div className="h-3 w-4/5 bg-muted animate-pulse rounded" />
                                <div className="h-3 w-3/4 bg-muted animate-pulse rounded" />
                            </div>

                            <div className="flex justify-between items-center">
                                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                                <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                            </div>

                            <div className="h-10 w-full bg-muted animate-pulse rounded" />
                        </div>
                    </div>
                ))}
            </div>

            <PageLoadingSpinner text="Finding opportunities for you..." />
        </div>
    )
} 