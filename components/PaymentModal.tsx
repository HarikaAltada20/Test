"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, DollarSign, Link } from "lucide-react";

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (paymentDetails: { paymentProofUrl: string; paymentDescription: string; amountInCents?: number; isCustom?: boolean }) => void;
    isLoading?: boolean;
    initialMode?: 'standard' | 'custom';
    showModeSwitcher?: boolean;
    showProofAndDescription?: boolean;
}

export default function PaymentModal({
    isOpen,
    onClose,
    onConfirm,
    isLoading = false,
    initialMode = 'standard',
    showModeSwitcher = true,
    showProofAndDescription = true,
}: PaymentModalProps) {
    const [paymentProofUrl, setPaymentProofUrl] = useState("");
    const [paymentDescription, setPaymentDescription] = useState("");
    const [mode, setMode] = useState<'standard' | 'custom'>(initialMode);
    // Sync mode when modal opens with a specific initial mode
    useEffect(() => {
        if (isOpen) {
            setMode(initialMode);
        }
    }, [isOpen, initialMode]);
    const [customAmount, setCustomAmount] = useState<string>("");

    const handleConfirm = () => {
        const isCustom = mode === 'custom';
        const amountInCents = isCustom ? Math.round((parseFloat(customAmount || '0') || 0) * 100) : undefined;
        onConfirm({
            paymentProofUrl: paymentProofUrl.trim(),
            paymentDescription: paymentDescription.trim(),
            amountInCents,
            isCustom,
        });
        // Reset form
        setPaymentProofUrl("");
        setPaymentDescription("");
        setCustomAmount("");
        setMode('standard');
    };

    const handleClose = () => {
        if (!isLoading) {
            setPaymentProofUrl("");
            setPaymentDescription("");
            onClose();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-green-600" />
                        Mark Submission as Paid
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {showModeSwitcher && (
                        <div className="flex gap-2">
                            <Button variant={mode === 'standard' ? 'default' : 'outline'} disabled={isLoading} onClick={() => setMode('standard')}>Mark as Paid</Button>
                            <Button variant={mode === 'custom' ? 'default' : 'outline'} disabled={isLoading} onClick={() => setMode('custom')}>Mark as Custom Paid</Button>
                        </div>
                    )}

                    {mode === 'custom' && (
                        <div className="space-y-2">
                            <Label htmlFor="customAmount">Custom Amount (USD)</Label>
                            <Input
                                id="customAmount"
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                value={customAmount}
                                onChange={(e) => setCustomAmount(e.target.value)}
                                disabled={isLoading}
                            />
                            <p className="text-xs text-muted-foreground">This amount will be credited to the creator's wallet and recorded as a reward (custom).</p>
                        </div>
                    )}

                    {showProofAndDescription && (
                        <div className="space-y-2">
                            <Label htmlFor="paymentProofUrl" className="flex items-center gap-2">
                                <Link className="h-4 w-4" />
                                Payment Proof URL (Optional)
                            </Label>
                            <Input
                                id="paymentProofUrl"
                                type="url"
                                placeholder="https://example.com/payment-proof"
                                value={paymentProofUrl}
                                onChange={(e) => setPaymentProofUrl(e.target.value)}
                                disabled={isLoading}
                            />
                            <p className="text-xs text-muted-foreground">
                                Link to payment receipt, screenshot, or transaction proof
                            </p>
                        </div>
                    )}

                    {showProofAndDescription && (
                        <div className="space-y-2">
                            <Label htmlFor="paymentDescription">Payment Details</Label>
                            <Textarea
                                id="paymentDescription"
                                placeholder="Enter payment details, transaction ID, or any additional notes..."
                                value={paymentDescription}
                                onChange={(e) => setPaymentDescription(e.target.value)}
                                disabled={isLoading}
                                rows={3}
                            />
                            <p className="text-xs text-muted-foreground">
                                Describe the payment method, amount, or any relevant details
                            </p>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-2 pt-4">
                    <Button
                        variant="outline"
                        onClick={handleClose}
                        disabled={isLoading}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={
                            isLoading ||
                            (mode === 'custom' && (!customAmount || isNaN(parseFloat(customAmount)) || parseFloat(customAmount) <= 0))
                        }
                        className="bg-green-600 hover:bg-green-700"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                Processing...
                            </>
                        ) : (
                            <>
                                <DollarSign className="h-4 w-4 mr-2" />
                                {mode === 'custom' ? 'Confirm Custom Pay' : 'Mark as Paid'}
                            </>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
} 