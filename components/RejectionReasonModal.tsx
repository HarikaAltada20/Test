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
import { AlertCircle, XCircle, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

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
    onConfirm: (reason: string, additionalNotes?: string) => void;
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
      
    const handleConfirm = () => {
        const finalReason = selectedReason === 'other' ? customReason : selectedReason;
        if (finalReason.trim()) {
            onConfirm(finalReason, additionalNotes.trim() || undefined);
        }
    };

    const handleClose = () => {
        setSelectedReason('');
        setCustomReason('');
        setAdditionalNotes('');
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
    const isDark = mode === "dark";
    return (
        <Dialog open={isOpen} onOpenChange={handleClose} isdark={isDark}>
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
            <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto">
                <DialogHeader className="space-y-3">
                    <div className="flex items-center gap-3">
                        {/* <div className="p-2 bg-red-100 rounded-full">
                            <XCircle className="h-5 w-5 text-red-600" />
                        </div> */}
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
                        <Alert className="border-[#7F39EC17] bg-[#7F39EC17]">
                            {/* <CheckCircle2 className="h-4 w-4 text-[#7F39EC]]" /> */}
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

                    {/* Additional Notes (Optional) */}
                    {selectedReason && selectedReason !== 'other' && (
                        <div className="space-y-3">
                            <Label htmlFor="additional-notes" className="text-sm font-medium">
                                Additional Notes (Optional)
                            </Label>
                            <div className="relative">
                                <Textarea
                                    id="additional-notes"
                                    placeholder="Add any additional context, specific feedback, or suggestions for improvement..."
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
                            <div className="flex items-start gap-2">
                                <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                                <p className="text-xs text-muted-foreground">
                                    Optional: Provide specific feedback, suggestions, or additional context that might help the creator improve their future submissions.
                                </p>
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
                        {/* <AlertCircle className="h-4 w-4"/> */}
                        <AlertDescription>
                            <span className="font-medium">Note:</span> Once rejected, this submission will be hidden from the public leaderboard and the creator will be notified of the rejection reason.
                        </AlertDescription>
                    </Alert>
                </div>

                <DialogFooter className="gap-3 pt-6 border-t mt-6">
                <button
                        onClick={handleConfirm}
                        disabled={isConfirmDisabled() || isLoading}
                        className={cn(
                            "w-full text-md rounded-full flex-1 sm:flex-none",
                            isDark
                              ? "bg-[#7F39EC] py-3"
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
                                {/* <XCircle className="h-4 w-4 mr-2" /> */}
                                Reject Submission
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
    );
} 