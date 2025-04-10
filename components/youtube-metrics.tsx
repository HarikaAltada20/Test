import { Eye, ThumbsUp, MessageSquare } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface VideoMetricsProps {
    submission: {
        id: string;
        video_id: string;
        video_title?: string;
        current_views: number;
        like_count: number;
        comment_count: number;
        last_metrics_update?: string;
    };
}

export default function VideoMetrics({ submission }: VideoMetricsProps) {
    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Video Performance</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-3 gap-4">
                    <div className="flex flex-col items-center justify-center p-2 bg-gray-50 rounded-lg">
                        <Eye className="h-5 w-5 text-blue-500 mb-1" />
                        <span className="text-lg font-bold">{submission.current_views.toLocaleString()}</span>
                        <span className="text-xs text-muted-foreground">Views</span>
                    </div>
                    <div className="flex flex-col items-center justify-center p-2 bg-gray-50 rounded-lg">
                        <ThumbsUp className="h-5 w-5 text-green-500 mb-1" />
                        <span className="text-lg font-bold">{submission.like_count.toLocaleString()}</span>
                        <span className="text-xs text-muted-foreground">Likes</span>
                    </div>
                    <div className="flex flex-col items-center justify-center p-2 bg-gray-50 rounded-lg">
                        <MessageSquare className="h-5 w-5 text-purple-500 mb-1" />
                        <span className="text-lg font-bold">{submission.comment_count.toLocaleString()}</span>
                        <span className="text-xs text-muted-foreground">Comments</span>
                    </div>
                </div>

                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="mt-3 text-xs text-right text-muted-foreground cursor-help">
                                Last updated: {submission.last_metrics_update
                                    ? new Date(submission.last_metrics_update).toLocaleString()
                                    : 'Never'}
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p className="text-xs">Metrics are automatically updated from YouTube</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </CardContent>
        </Card>
    );
} 