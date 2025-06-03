import { PageLoadingSpinner } from "@/components/loading/LoadingSpinner"

export default function SubmissionsLoading() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="h-8 w-48 bg-muted animate-pulse rounded" />
                <div className="h-10 w-40 bg-muted animate-pulse rounded" />
            </div>

            {/* Tabs skeleton */}
            <div className="flex space-x-1 bg-muted p-1 rounded-lg w-fit">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-8 w-20 bg-background animate-pulse rounded" />
                ))}
            </div>

            <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="border rounded-lg p-6">
                        <div className="flex items-start gap-4">
                            {/* Thumbnail skeleton */}
                            <div className="w-24 h-16 bg-muted animate-pulse rounded" />

                            <div className="flex-1 space-y-3">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-2">
                                        <div className="h-5 w-64 bg-muted animate-pulse rounded" />
                                        <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                                    </div>
                                    <div className="h-6 w-20 bg-muted animate-pulse rounded-full" />
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="space-y-1">
                                        <div className="h-3 w-12 bg-muted animate-pulse rounded" />
                                        <div className="h-4 w-16 bg-muted animate-pulse rounded" />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="h-3 w-16 bg-muted animate-pulse rounded" />
                                        <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="h-3 w-14 bg-muted animate-pulse rounded" />
                                        <div className="h-4 w-18 bg-muted animate-pulse rounded" />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="h-3 w-10 bg-muted animate-pulse rounded" />
                                        <div className="h-4 w-14 bg-muted animate-pulse rounded" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <PageLoadingSpinner text="Loading your submissions..." />
        </div>
    )
} 