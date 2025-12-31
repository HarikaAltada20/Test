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

    const [mode, setMode] = useState<"light" | "dark">(getInitialMode);
    // Read mode from data attribute and html class, respond to changes
    useEffect(() => {
        const readMode = (): "light" | "dark" => {
            const el = document.querySelector("[data-mode]");
            const attr = el?.getAttribute("data-mode");
            if (attr === "dark" || attr === "light") return attr;
            return document.documentElement.classList.contains("dark")
                ? "dark"
                : "light";
        };

        // Set immediately on mount to avoid any flicker
        setMode(readMode());

        // Watch for changes on either data-mode or html class
        const observer = new MutationObserver(() => {
            setMode(readMode());
        });
        const dataModeTarget = document.querySelector("[data-mode]");
        if (dataModeTarget) {
            observer.observe(dataModeTarget, {
                attributes: true,
                attributeFilter: ["data-mode"],
            });
        }
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["class"],
        });

        return () => observer.disconnect();
    }, []);

    const handleClose = () => {
        setSelectedReason('');
        setCustomReason('');
        setAdditionalNotes('');
        onClose();
    };

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

    const getSelectedReasonDescription = () => {
        if (!selectedReason) return '';
        const reason = TWITTER_REJECTION_REASONS.find(r => r.value === selectedReason);
        return reason?.description || '';
    };

    const getSelectedReasonLabel = () => {
        if (!selectedReason) return '';
        const reason = TWITTER_REJECTION_REASONS.find(r => r.value === selectedReason);
        return reason?.label || '';
    };

    const isConfirmDisabled = () => {
        if (selectedReason === 'other') {
            return !customReason.trim() || customReason.trim().length < 10;
        }
        return !selectedReason;
    };

    const getValidationMessage = () => {
        if (selectedReason === 'other' && customReason.trim().length > 0 && customReason.trim().length < 10) {
            return 'Please provide a more detailed reason (at least 10 characters)';
        }
        return '';
    };
    const isDark = mode === "dark";

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
                .select-value[data-placeholder] {
                    opacity: 0.6 !important;
                }
                .select-item span {
                    display: block !important;
                    width: 100% !important;
                }
            `}</style>
            <Dialog open={isOpen} onOpenChange={handleClose} isdark={isDark}>
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
                        {/* Rejection Reason Selection */}
                        <div className="space-y-3">
                            <Label htmlFor="reason-select" className="text-sm font-medium">
                                Rejection Reason *
                            </Label>
                            <Select value={selectedReason} onValueChange={setSelectedReason}>
                                <SelectTrigger className="h-12 text-left select-trigger">
                                    <SelectValue placeholder="Choose a reason for rejection..." className="text-left select-value" />
                                </SelectTrigger>
                                <SelectContent
                                    className="max-h-[250px] w-full select-content overflow-y-auto"
                                    sideOffset={8}
                                    align="start"
                                    position="popper"
                                    side="bottom"
                                    isDark={isDark}
                                >
                                    {TWITTER_REJECTION_REASONS.map((reason) => (
                                        <SelectItem key={reason.value} value={reason.value} className="select-item" isDark={isDark}>
                                            <div className="select-item-content">
                                                <span className="font-medium text-sm">{reason.label}</span>
                                                <span className="text-xs text-muted-foreground leading-relaxed">{reason.description}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Selected Reason Preview */}
                        {selectedReason && selectedReason !== 'other' && (
                            <Alert className="border-[#7F39EC17] bg-[#7F39EC17]">
                                <AlertDescription className="text-[#7F39EC]">
                                    <div className="space-y-1">
                                        <div className="font-medium">Selected Reason: {getSelectedReasonLabel()}</div>
                                        <div className="text-sm">{getSelectedReasonDescription()}</div>
                                    </div>
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Custom Reason Input */}
                        {selectedReason === 'other' && (
                            <div className="space-y-3">
                                <Label htmlFor="custom-reason" className="text-sm font-medium">
                                    Custom Reason *
                                </Label>
                                <div className="relative">
                                    <Textarea
                                        id="custom-reason"
                                        placeholder="Please provide a specific and constructive reason for rejection. This will help the creator improve their future submissions..."
                                        value={customReason}
                                        onChange={(e) => setCustomReason(e.target.value)}
                                        rows={4}
                                        className="resize-none pr-12"
                                        maxLength={500}
                                    />
                                    <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
                                        {customReason.length}/500
                                    </div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                                    <p className="text-xs text-muted-foreground">
                                        Be specific and constructive. This feedback will be shared with the creator to help them improve future submissions.
                                    </p>
                                </div>
                                {getValidationMessage() && (
                                    <Alert className="border-red-200 bg-red-50">
                                        <AlertCircle className="h-4 w-4 text-red-600" />
                                        <AlertDescription className="text-red-800 text-xs">
                                            {getValidationMessage()}
                                        </AlertDescription>
                                    </Alert>
                                )}
                            </div>
                        )}

                        {/* Additional Notes (Optional for predefined reasons) */}
                        {selectedReason && selectedReason !== 'other' && (
                            <div className="space-y-3">
                                <Label htmlFor="additional-notes" className="text-sm font-medium">
                                    Additional Notes (Optional)
                                </Label>
                                <div className="relative">
                                    <Textarea
                                        id="additional-notes"
                                        placeholder="Add any specific context or feedback for the creator..."
                                        value={additionalNotes}
                                        onChange={(e) => setAdditionalNotes(e.target.value)}
                                        rows={3}
                                        className="resize-none pr-12"
                                        maxLength={300}
                                    />
                                    <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
                                        {additionalNotes.length}/300
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Warning Alert */}
                        <Alert
                            className={cn(
                                isDark
                                    ? "bg-[#FDD36F5C] text-[#FDD36F]"
                                    : "border-orange-200 bg-orange-50 text-orange-800"
                            )}>
                            <AlertDescription>
                                <span className="font-medium">Note:</span> Once rejected, {isCreatorRejection ? 'all tweets from this creator' : 'this tweet'} will be hidden from the public leaderboard and the creator will be notified of the rejection reason.
                            </AlertDescription>
                        </Alert>
                    </div>

                    <DialogFooter className="gap-3 pt-6 border-t mt-6">
                        <button
                            onClick={handleSubmit}
                            disabled={isConfirmDisabled() || isLoading}
                            className={cn(
                                "w-full text-md rounded-full flex-1 sm:flex-none",
                                isDark
                                    ? "bg-[#7F39EC] py-3 text-white"
                                    : " bg-[#D9C0FF61] py-4 text-[#7F39EC] "
                            )}
                        >
                            {isLoading ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                    Rejecting...
                                </>
                            ) : (
                                <>
                                    {isCreatorRejection ? 'Reject All Creator Tweets' : 'Reject Tweet'}
                                </>
                            )}
                        </button>
                        <button
                            onClick={handleClose}
                            disabled={isLoading}
                            className={cn(
                                "w-full text-md rounded-full flex-1 sm:flex-none",
                                isDark
                                    ? "py-3 border border-[#FF5353] text-[#FF5353]"
                                    : "bg-[#FF323224] text-[#E50000] py-4"
                            )}
                        >
                            Cancel
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

