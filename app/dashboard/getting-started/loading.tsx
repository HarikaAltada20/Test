import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function GettingStartedLoading() {
    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            {/* Header Section */}
            <div className="mb-8 text-center">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-96 mx-auto" />
                    <Skeleton className="h-4 w-80 mx-auto" />
                </div>
            </div>

            {/* Contest Types Section */}
            <div className="space-y-8">
                {/* Leaderboard Contest Section */}
                <Card className="border border-gray-200 dark:border-gray-700">
                    <CardHeader className="text-center pb-4">
                        <div className="flex items-center justify-center space-x-3 mb-2">
                            <Skeleton className="w-10 h-10 rounded-lg" />
                            <Skeleton className="h-6 w-48" />
                        </div>
                        <Skeleton className="h-6 w-32 mx-auto" />
                    </CardHeader>

                    <CardContent className="space-y-6">
                        {/* Simple Visual */}
                        <div className="text-center">
                            <Skeleton className="h-16 w-80 mx-auto" />
                        </div>

                        {/* Simple Benefits */}
                        <div className="grid md:grid-cols-2 gap-4">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="flex items-start space-x-3">
                                    <Skeleton className="w-5 h-5 rounded-full flex-shrink-0" />
                                    <Skeleton className="h-4 w-full" />
                                </div>
                            ))}
                        </div>

                        <div className="text-center pt-4">
                            <Skeleton className="h-10 w-48 mx-auto" />
                        </div>
                    </CardContent>
                </Card>

                {/* CPM Contest Section */}
                <Card className="border border-gray-200 dark:border-gray-700">
                    <CardHeader className="text-center pb-4">
                        <div className="flex items-center justify-center space-x-3 mb-2">
                            <Skeleton className="w-10 h-10 rounded-lg" />
                            <Skeleton className="h-6 w-32" />
                        </div>
                        <Skeleton className="h-6 w-32 mx-auto" />
                    </CardHeader>

                    <CardContent className="space-y-6">
                        {/* Simple Visual */}
                        <div className="text-center">
                            <Skeleton className="h-16 w-80 mx-auto" />
                        </div>

                        {/* Simple Benefits */}
                        <div className="grid md:grid-cols-2 gap-4">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="flex items-start space-x-3">
                                    <Skeleton className="w-5 h-5 rounded-full flex-shrink-0" />
                                    <Skeleton className="h-4 w-full" />
                                </div>
                            ))}
                        </div>

                        <div className="text-center pt-4">
                            <Skeleton className="h-10 w-40 mx-auto" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Help Section */}
            <Card className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 border-0 mt-8">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <Skeleton className="w-12 h-12 rounded-full" />
                            <div className="space-y-2">
                                <Skeleton className="h-6 w-48" />
                                <Skeleton className="h-4 w-64" />
                            </div>
                        </div>
                        <div className="flex space-x-3">
                            <Skeleton className="h-10 w-32" />
                            <Skeleton className="h-10 w-32" />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
} 