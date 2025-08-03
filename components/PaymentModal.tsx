"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, DollarSign, Link } from "lucide-react";

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (paymentDetails: { paymentProofUrl: string; paymentDescription: string }) => void;
    isLoading?: boolean;
}

export default function PaymentModal({
    isOpen,
    onClose,
    onConfirm,
    isLoading = false,
}: PaymentModalProps) {
    const [paymentProofUrl, setPaymentProofUrl] = useState("");
    const [paymentDescription, setPaymentDescription] = useState("");

    const handleConfirm = () => {
        onConfirm({
            paymentProofUrl: paymentProofUrl.trim(),
            paymentDescription: paymentDescription.trim(),
        });
        // Reset form
        setPaymentProofUrl("");
        setPaymentDescription("");
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
                        disabled={isLoading || (!paymentProofUrl && !paymentDescription)}
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
                                Mark as Paid
                            </>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
} 