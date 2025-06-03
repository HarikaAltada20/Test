import { PageLoadingSpinner } from "@/components/loading/LoadingSpinner"

export default function ContestsLoading() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="h-8 w-48 bg-muted animate-pulse rounded" />
                <div className="h-10 w-32 bg-muted animate-pulse rounded" />
            </div>

            <div className="space-y-4">
                <div className="h-6 w-32 bg-muted animate-pulse rounded" />
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="p-6 border rounded-lg space-y-4">
                            <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
                            <div className="h-3 w-1/2 bg-muted animate-pulse rounded" />
                            <div className="h-3 w-full bg-muted animate-pulse rounded" />
                            <div className="flex justify-between">
                                <div className="h-3 w-16 bg-muted animate-pulse rounded" />
                                <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <PageLoadingSpinner text="Loading your contests..." />
        </div>
    )
} 