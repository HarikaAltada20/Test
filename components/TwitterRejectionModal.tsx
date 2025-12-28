import React, { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { AlertCircle, XCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

// Twitter-specific predefined rejection reasons
const TWITTER_REJECTION_REASONS = [
    {
        value: 'spam_or_low_quality',
        label: 'Spam or Low Quality Tweet',
        description: 'Tweet appears to be spam, automated, or does not meet quality standards'
    },
    {
        value: 'not_engaging_target',
        label: 'Not Engaging Target Tweet',
        description: 'Tweet does not properly engage with the target tweet (not a reply, retweet, or quote repost)'
    },
    {
        value: 'inappropriate_content',
        label: 'Inappropriate Content',
        description: 'Content is offensive, harmful, or violates community guidelines'
    },
    {
        value: 'contest_rules',
        label: 'Contest Rules Not Followed',
        description: 'Tweet does not follow the contest brief, rules, or requirements'
    },
    {
        value: 'duplicate_engagement',
        label: 'Duplicate Engagement',
        description: 'Same or very similar engagement already submitted by this creator'
    },
    {
        value: 'fake_or_manipulated',
        label: 'Fake or Manipulated Engagement',
        description: 'Engagement appears to be artificially inflated or manipulated'
    },
    {
        value: 'terms_violation',
        label: 'Terms & Conditions Violation',
        description: 'Violates Twitter terms of service or platform rules'
    },
    {
        value: 'other',
        label: 'Custom Reason',
        description: 'Provide a specific custom reason in your own words'
    }
];

interface TwitterRejectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string, additionalNotes?: string) => void;
    isLoading?: boolean;
    isCreatorRejection?: boolean;
    creatorUsername?: string;
}

export default function TwitterRejectionModal({
    isOpen,
    onClose,
    onConfirm,
    isLoading = false,
    isCreatorRejection = false,
    creatorUsername
}: TwitterRejectionModalProps) {
    const [selectedReason, setSelectedReason] = useState<string>('');
    const [customReason, setCustomReason] = useState<string>('');
    const [additionalNotes, setAdditionalNotes] = useState<string>('');
    
    const getInitialMode = (): "light" | "dark" => {
        if (typeof document === "undefined") return "light";
        const dataMode = document
            .querySelector("[data-mode]")
            ?.getAttribute("data-mode");
        if (dataMode === "dark" || dataMode === "light") {
            return dataMode;
        }
        if (document.documentElement.classList.contains("dark")) {
            return "dark";
        }
        if (
            typeof window !== "undefined" &&
            window.matchMedia &&
            window.matchMedia("(prefers-color-scheme: dark)").matches
        ) {
            return "dark";
        }
        return "light";
    };

    const [isDark, setIsDark] = useState<"light" | "dark">(getInitialMode());

    useEffect(() => {
        const observer = new MutationObserver(() => {
            setIsDark(getInitialMode());
        });

        const htmlElement = document.documentElement;
        observer.observe(htmlElement, {
            attributes: true,
            attributeFilter: ['class', 'data-mode'],
        });

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!isOpen) {
            // Reset form when modal closes
            setSelectedReason('');
            setCustomReason('');
            setAdditionalNotes('');
        }
    }, [isOpen]);

    const selectedReasonData = TWITTER_REJECTION_REASONS.find(
        (r) => r.value === selectedReason
    );

    const showCustomReason = selectedReason === 'other';
    const canSubmit = selectedReason && (showCustomReason ? customReason.trim().length >= 10 : true);

    const handleSubmit = () => {
        if (!canSubmit) return;

        let fullReason = '';
        if (showCustomReason) {
            fullReason = customReason.trim();
        } else {
            fullReason = selectedReasonData?.label || selectedReason;
        }

        if (additionalNotes.trim()) {
            fullReason = `${fullReason}\n\nAdditional Notes: ${additionalNotes.trim()}`;
        }

        onConfirm(fullReason, additionalNotes.trim() || undefined);
    };

    return (
        <>
            <style jsx>{`
                .select-content {
                    width: 100% !important;
                    max-width: 100% !important;
                    min-width: 100% !important;
                    z-index: 9999 !important;
                }
                .select-item {
                    text-align: left !important;
                    justify-content: flex-start !important;
                    padding: 12px 16px !important;
                    min-height: auto !important;
                    height: auto !important;
                    white-space: normal !important;
                    word-wrap: break-word !important;
                    overflow: visible !important;
                    cursor: pointer !important;
                    border-radius: 4px !important;
                    margin: 2px 0 !important;
                }
                .select-item-content {
                    width: 100% !important;
                    text-align: left !important;
                    display: flex !important;
                    flex-direction: column !important;
                    gap: 4px !important;
                    pointer-events: none !important;
                }
                .select-item:hover {
                    background-color: hsl(var(--accent)) !important;
                }
                .select-item[data-state="checked"] {
                    background-color: hsl(var(--accent)) !important;
                }
                .select-item[data-highlighted] {
                    background-color: hsl(var(--accent)) !important;
                }
                .select-trigger {
                    text-align: left !important;
                    justify-content: flex-start !important;
                }
                .select-value {
                    text-align: left !important;
                    width: 100% !important;
                }
                .select-item span {
                    display: block !important;
                    width: 100% !important;
                }
            `}</style>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className={cn("max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto", isDark ? "text-white" : "text-gray-800")}>
                    <DialogHeader className="space-y-3">
                        <div className="flex items-center gap-3">
                            <div>
                                <DialogTitle className="text-xl font-semibold">
                                    {isCreatorRejection ? `Reject Creator${creatorUsername ? `: @${creatorUsername}` : ''}` : 'Reject Tweet'}
                                </DialogTitle>
                                <DialogDescription className="text-sm text-muted-foreground mt-1">
                                    {isCreatorRejection 
                                        ? `Please select a reason for rejecting all tweets from this creator. This will reject all their tweets in this campaign.`
                                        : 'Please select a reason for rejecting this tweet. This will help the creator understand why their engagement was not accepted.'}
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="space-y-6 py-6 px-1">
                        <div className="space-y-2">
                            <Label htmlFor="reason-select" className="text-sm font-medium">
                                Rejection Reason <span className="text-red-500">*</span>
                            </Label>
                            <Select value={selectedReason} onValueChange={setSelectedReason}>
                                <SelectTrigger
                                    id="reason-select"
                                    className={cn(
                                        "w-full",
                                        isDark ? "bg-[#1a1a1a] border-gray-700" : "bg-white border-gray-300"
                                    )}
                                >
                                    <SelectValue placeholder="Select a reason for rejection" />
                                </SelectTrigger>
                                <SelectContent className="select-content">
                                    {TWITTER_REJECTION_REASONS.map((reason) => (
                                        <SelectItem
                                            key={reason.value}
                                            value={reason.value}
                                            className="select-item"
                                        >
                                            <div className="select-item-content">
                                                <span className="font-medium">{reason.label}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    {reason.description}
                                                </span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {selectedReasonData && !showCustomReason && (
                            <Alert className={cn(
                                isDark ? "bg-[#1a1a1a] border-gray-700" : "bg-blue-50 border-blue-200"
                            )}>
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription className="text-sm">
                                    <strong>{selectedReasonData.label}:</strong>{' '}
                                    {selectedReasonData.description}
                                </AlertDescription>
                            </Alert>
                        )}

                        {showCustomReason && (
                            <div className="space-y-2">
                                <Label htmlFor="custom-reason" className="text-sm font-medium">
                                    Custom Reason <span className="text-red-500">*</span>
                                </Label>
                                <Textarea
                                    id="custom-reason"
                                    placeholder="Please provide a detailed reason for rejection (minimum 10 characters)..."
                                    value={customReason}
                                    onChange={(e) => setCustomReason(e.target.value)}
                                    className={cn(
                                        "min-h-[100px]",
                                        isDark ? "bg-[#1a1a1a] border-gray-700" : "bg-white border-gray-300"
                                    )}
                                />
                                <p className="text-xs text-muted-foreground">
                                    {customReason.length}/10 characters (minimum required)
                                </p>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="additional-notes" className="text-sm font-medium">
                                Additional Notes (Optional)
                            </Label>
                            <Textarea
                                id="additional-notes"
                                placeholder="Add any additional context or details about this rejection..."
                                value={additionalNotes}
                                onChange={(e) => setAdditionalNotes(e.target.value)}
                                className={cn(
                                    "min-h-[80px]",
                                    isDark ? "bg-[#1a1a1a] border-gray-700" : "bg-white border-gray-300"
                                )}
                            />
                        </div>

                        {!canSubmit && selectedReason && (
                            <Alert variant="destructive">
                                <XCircle className="h-4 w-4" />
                                <AlertDescription>
                                    {showCustomReason
                                        ? 'Please provide a custom reason (minimum 10 characters)'
                                        : 'Please select a rejection reason'}
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>

                    <DialogFooter className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={onClose}
                            disabled={isLoading}
                            className={cn(
                                isDark ? "border-gray-700 hover:bg-gray-800" : ""
                            )}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={!canSubmit || isLoading}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            {isLoading ? 'Processing...' : isCreatorRejection ? 'Reject All Creator Tweets' : 'Reject Tweet'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

