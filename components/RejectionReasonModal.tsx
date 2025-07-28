import React, { useState } from 'react';
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
import { AlertCircle, XCircle, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Predefined rejection reasons with improved descriptions
const PREDEFINED_REASONS = [
    {
        value: 'content_guidelines',
        label: 'Content Guidelines Violation',
        description: 'Content does not follow the contest guidelines, platform rules, or community standards'
    },
    {
        value: 'quality_standards',
        label: 'Quality Standards Not Met',
        description: 'Content quality, production value, or presentation does not meet the required standards'
    },
    {
        value: 'brand_guidelines',
        label: 'Brand Guidelines Violation',
        description: 'Content does not align with our brand guidelines, tone, or messaging requirements'
    },
    {
        value: 'inappropriate_content',
        label: 'Inappropriate Content',
        description: 'Content contains inappropriate, offensive, or unsuitable material for our platform'
    },
    {
        value: 'copyright_issues',
        label: 'Copyright Issues',
        description: 'Content may violate copyright, trademark, or intellectual property rights'
    },
    {
        value: 'technical_issues',
        label: 'Technical Issues',
        description: 'Content has technical problems, is not accessible, or fails to load properly'
    },
    {
        value: 'off_topic',
        label: 'Off Topic',
        description: 'Content is not relevant to the contest theme, brief, or specific requirements'
    },
    {
        value: 'duplicate_content',
        label: 'Duplicate Content',
        description: 'Content appears to be duplicate or very similar to existing submissions or previous work'
    },
    {
        value: 'incomplete_submission',
        label: 'Incomplete Submission',
        description: 'Submission is incomplete, missing required elements, or appears unfinished'
    },
    {
        value: 'other',
        label: 'Other Reason',
        description: 'Other reason not listed above - please provide specific details'
    }
];

interface RejectionReasonModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => void;
    isLoading?: boolean;
}

export default function RejectionReasonModal({
    isOpen,
    onClose,
    onConfirm,
    isLoading = false
}: RejectionReasonModalProps) {
    const [selectedReason, setSelectedReason] = useState<string>('');
    const [customReason, setCustomReason] = useState<string>('');

    const handleConfirm = () => {
        const finalReason = selectedReason === 'other' ? customReason : selectedReason;
        if (finalReason.trim()) {
            onConfirm(finalReason);
        }
    };

    const handleClose = () => {
        setSelectedReason('');
        setCustomReason('');
        onClose();
    };

    const getSelectedReasonDescription = () => {
        if (!selectedReason) return '';
        const reason = PREDEFINED_REASONS.find(r => r.value === selectedReason);
        return reason?.description || '';
    };

    const getSelectedReasonLabel = () => {
        if (!selectedReason) return '';
        const reason = PREDEFINED_REASONS.find(r => r.value === selectedReason);
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

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
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
            <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
                <DialogHeader className="space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 rounded-full">
                            <XCircle className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-semibold">Reject Submission</DialogTitle>
                            <DialogDescription className="text-sm text-muted-foreground mt-1">
                                Please select a reason for rejecting this submission. This will help the creator understand why their submission was not accepted.
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
                            >
                                {PREDEFINED_REASONS.map((reason) => (
                                    <SelectItem key={reason.value} value={reason.value} className="select-item">
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
                        <Alert className="border-blue-200 bg-blue-50">
                            <CheckCircle2 className="h-4 w-4 text-blue-600" />
                            <AlertDescription className="text-blue-800">
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

                    {/* Warning Alert */}
                    <Alert className="border-orange-200 bg-orange-50">
                        <AlertCircle className="h-4 w-4 text-orange-600" />
                        <AlertDescription className="text-orange-800">
                            <span className="font-medium">Note:</span> Once rejected, this submission will be hidden from the public leaderboard and the creator will be notified of the rejection reason.
                        </AlertDescription>
                    </Alert>
                </div>

                <DialogFooter className="gap-3 pt-6 border-t mt-6">
                    <Button
                        variant="outline"
                        onClick={handleClose}
                        disabled={isLoading}
                        className="flex-1 sm:flex-none"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={isConfirmDisabled() || isLoading}
                        className="bg-red-600 hover:bg-red-700 text-white flex-1 sm:flex-none"
                    >
                        {isLoading ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Rejecting...
                            </>
                        ) : (
                            <>
                                <XCircle className="h-4 w-4 mr-2" />
                                Reject Submission
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
} 