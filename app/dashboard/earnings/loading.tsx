import { PageLoadingSpinner } from "@/components/loading/LoadingSpinner"

export default function EarningsLoading() {
    return (
        <div className="space-y-6">
            <div className="h-8 w-40 bg-muted animate-pulse rounded" />

            {/* Stats cards skeleton */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="border rounded-lg p-6 space-y-2">
                        <div className="flex justify-between items-center">
                            <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                            <div className="h-4 w-4 bg-muted animate-pulse rounded" />
                        </div>
                        <div className="h-8 w-20 bg-muted animate-pulse rounded" />
                        <div className="h-3 w-32 bg-muted animate-pulse rounded" />
                    </div>
                ))}
            </div>

            {/* Tabs skeleton */}
            <div className="flex space-x-1 bg-muted p-1 rounded-lg w-fit">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-8 w-28 bg-background animate-pulse rounded" />
                ))}
            </div>

            {/* Content skeleton */}
            <div className="space-y-4">
                <div className="border rounded-lg p-6">
                    <div className="h-6 w-32 bg-muted animate-pulse rounded mb-4" />
                    <div className="space-y-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="flex justify-between items-center py-2">
                                <div className="space-y-1">
                                    <div className="h-4 w-48 bg-muted animate-pulse rounded" />
                                    <div className="h-3 w-32 bg-muted animate-pulse rounded" />
                                </div>
                                <div className="space-y-1 text-right">
                                    <div className="h-4 w-16 bg-muted animate-pulse rounded ml-auto" />
                                    <div className="h-3 w-12 bg-muted animate-pulse rounded ml-auto" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <PageLoadingSpinner text="Loading your earnings..." />
        </div>
    )
} 