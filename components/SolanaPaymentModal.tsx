"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { Copy, Check, ExternalLink, Loader2, AlertCircle, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SolanaPaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: (newBalance: number) => void;
}

interface PaymentRequest {
    id: string;
    referenceId: string;
    amount: number;
    amountCents: number;
    tokenType: 'USDC' | 'USDT';
    memo: string;
    walletAddress: string;
    expiresAt: string;
    instructions: {
        step1: string;
        step2: string;
        step3: string;
        step4: string;
    };
}

export function SolanaPaymentModal({
    isOpen,
    onClose,
    onSuccess,
}: SolanaPaymentModalProps) {
    const [step, setStep] = useState<'amount' | 'instructions' | 'verify'>('amount');
    const [amount, setAmount] = useState<string>('50');
    const [tokenType, setTokenType] = useState<'USDC' | 'USDT'>('USDC');
    const [isLoading, setIsLoading] = useState(false);
    const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
    const [transactionSignature, setTransactionSignature] = useState('');
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [isVerifying, setIsVerifying] = useState(false);

    const predefinedAmounts = ['25', '50', '100', '250', '500'];

    const handleCreatePaymentRequest = async () => {
        if (!amount || parseFloat(amount) <= 0) {
            toast.error('Please enter a valid amount');
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch('/api/solana/payment-request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: parseFloat(amount),
                    tokenType,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to create payment request');
            }

            setPaymentRequest(data.paymentRequest);
            setStep('instructions');
            toast.success('Payment request created successfully!');
        } catch (error) {
            console.error('Error creating payment request:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to create payment request');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopy = async (text: string, field: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedField(field);
            toast.success('Copied to clipboard!');
            setTimeout(() => setCopiedField(null), 2000);
        } catch (error) {
            toast.error('Failed to copy');
        }
    };

    const handleVerifyPayment = async () => {
        if (!transactionSignature.trim()) {
            toast.error('Please enter your transaction signature');
            return;
        }

        if (!paymentRequest) {
            toast.error('No payment request found');
            return;
        }

        setIsVerifying(true);
        try {
            const response = await fetch('/api/solana/verify-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transactionSignature: transactionSignature.trim(),
                    referenceId: paymentRequest.referenceId,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Payment verification failed');
            }

            toast.success('Payment verified successfully! Your balance has been updated.');

            if (onSuccess) {
                onSuccess(data.transaction.newBalance * 100); // Convert to cents
            }

            // Reset and close
            setTimeout(() => {
                handleClose();
            }, 2000);
        } catch (error) {
            console.error('Error verifying payment:', error);
            toast.error(error instanceof Error ? error.message : 'Payment verification failed');
        } finally {
            setIsVerifying(false);
        }
    };

    const handleClose = () => {
        setStep('amount');
        setAmount('50');
        setTokenType('USDC');
        setPaymentRequest(null);
        setTransactionSignature('');
        setCopiedField(null);
        onClose();
    };

    const renderAmountStep = () => (
        <div className="space-y-6">
            <div>
                <Label className="text-base font-semibold mb-3 block">Select Token</Label>
                <p className="text-sm text-muted-foreground mb-4">
                    Choose the token you have in your Phantom Wallet. Both USDC and USDT are supported.
                </p>
                <RadioGroup value={tokenType} onValueChange={(value) => setTokenType(value as 'USDC' | 'USDT')}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex items-center space-x-2 border-2 border-gray-200 rounded-lg p-4 cursor-pointer hover:border-[#7F39EC] transition-all"
                            onClick={() => setTokenType('USDC')}>
                            <RadioGroupItem value="USDC" id="usdc" />
                            <Label htmlFor="usdc" className="cursor-pointer font-medium flex-1">
                                <div>USDC <span className="text-green-600 text-xs">(Recommended)</span></div>
                                <div className="text-xs text-gray-500">USD Coin</div>
                            </Label>
                        </div>
                        <div className="flex items-center space-x-2 border-2 border-gray-200 rounded-lg p-4 cursor-pointer hover:border-[#7F39EC] transition-all"
                            onClick={() => setTokenType('USDT')}>
                            <RadioGroupItem value="USDT" id="usdt" />
                            <Label htmlFor="usdt" className="cursor-pointer font-medium flex-1">
                                <div>USDT</div>
                                <div className="text-xs text-gray-500">Tether USD</div>
                            </Label>
                        </div>
                    </div>
                </RadioGroup>
            </div>

            <div>
                <Label className="text-base font-semibold mb-3 block">Quick Amounts</Label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {predefinedAmounts.map((amt) => (
                        <Button
                            key={amt}
                            variant={amount === amt ? 'default' : 'outline'}
                            onClick={() => setAmount(amt)}
                            className={amount === amt ? 'bg-[#7F39EC] hover:bg-[#6929D1]' : ''}
                        >
                            ${amt}
                        </Button>
                    ))}
                </div>
            </div>

            <div>
                <Label htmlFor="custom-amount" className="text-base font-semibold">Custom Amount</Label>
                <div className="relative mt-2">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <Input
                        id="custom-amount"
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="Enter amount"
                        className="pl-7"
                        min="1"
                        step="0.01"
                    />
                </div>
            </div>

            <Alert className="bg-blue-50 border-blue-200">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-sm text-blue-800">
                    Payment will be processed automatically within 1-2 minutes after sending the transaction.
                </AlertDescription>
            </Alert>

            <Button
                onClick={handleCreatePaymentRequest}
                disabled={isLoading || !amount || parseFloat(amount) <= 0}
                className="w-full bg-[#7F39EC] hover:bg-[#6929D1]"
                size="lg"
            >
                {isLoading ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating Request...
                    </>
                ) : (
                    <>Continue to Payment</>
                )}
            </Button>
        </div>
    );

    const renderInstructionsStep = () => {
        if (!paymentRequest) return null;

        const expiryDate = new Date(paymentRequest.expiresAt).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });

        return (
            <div className="space-y-6">
                <div className="bg-gradient-to-r from-[#7F39EC] to-[#4A00BE] text-white rounded-lg p-4 sm:p-6 text-center">
                    <div className="text-sm opacity-90 mb-2">Amount to Send</div>
                    <div className="text-3xl sm:text-4xl font-bold">${paymentRequest.amount.toFixed(2)}</div>
                    <div className="text-base sm:text-lg mt-1">{paymentRequest.tokenType}</div>
                </div>

                <div className="space-y-4">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <Label className="font-semibold">Wallet Address</Label>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCopy(paymentRequest.walletAddress, 'wallet')}
                            >
                                {copiedField === 'wallet' ? (
                                    <Check className="h-4 w-4 text-green-600" />
                                ) : (
                                    <Copy className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                        <div className="bg-gray-100 rounded-lg p-3 break-all text-sm font-mono">
                            {paymentRequest.walletAddress}
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <Label className="font-semibold">Reference ID</Label>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCopy(paymentRequest.referenceId, 'ref')}
                            >
                                {copiedField === 'ref' ? (
                                    <Check className="h-4 w-4 text-green-600" />
                                ) : (
                                    <Copy className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                        <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-3 break-all text-lg font-mono font-bold text-center">
                            {paymentRequest.referenceId}
                        </div>
                        <div className="mt-2">
                            <p className="text-xs text-gray-600">
                                Keep this reference ID - you'll need it to verify your payment after sending
                            </p>
                        </div>
                    </div>
                </div>

                <Alert className="bg-blue-50 border-blue-200">
                    <AlertCircle className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-sm text-blue-800">
                        <strong>Simple Instructions:</strong><br />
                        1. Send exactly <strong>${paymentRequest.amount.toFixed(2)} {paymentRequest.tokenType}</strong> to the wallet address above<br />
                        2. Make sure you're sending <strong>{paymentRequest.tokenType}</strong> (not the other token)<br />
                        3. After sending, click "I've Sent the Payment" below<br />
                        4. Enter your transaction signature and reference ID<br />
                        <strong>Expires:</strong> {expiryDate}
                    </AlertDescription>
                </Alert>

                <div className="space-y-2">
                    <Button
                        onClick={() => setStep('verify')}
                        className="w-full bg-[#7F39EC] hover:bg-[#6929D1]"
                        size="lg"
                    >
                        I've Sent the Payment
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleClose}
                        className="w-full"
                    >
                        Cancel
                    </Button>
                </div>
            </div>
        );
    };

    const renderVerifyStep = () => (
        <div className="space-y-6">
            <div className="text-center">
                <div className="text-4xl sm:text-6xl mb-4">✅</div>
                <h3 className="text-lg font-semibold mb-2">Verify Your Payment</h3>
                <p className="text-gray-600 text-sm">
                    Enter your transaction signature from Phantom Wallet to verify your payment instantly.
                </p>
            </div>

            <div>
                <Label htmlFor="transaction-signature" className="font-semibold">
                    Transaction Signature (Required)
                </Label>
                <p className="text-xs text-gray-500 mb-2">
                    Find this in Phantom Wallet → Activity → Click your recent transaction → Copy signature
                </p>
                <Input
                    id="transaction-signature"
                    value={transactionSignature}
                    onChange={(e) => setTransactionSignature(e.target.value)}
                    placeholder="Enter transaction signature..."
                    className="font-mono text-sm"
                />
            </div>

            <Alert className="bg-green-50 border-green-200">
                <Info className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-sm text-green-800">
                    <strong>How to find your transaction signature:</strong><br />
                    1. Open Phantom Wallet<br />
                    2. Tap "Activity" or recent transactions<br />
                    3. Find your {paymentRequest?.tokenType} transaction<br />
                    4. Tap/click on it to see details<br />
                    5. Copy the signature (long string of numbers/letters)
                </AlertDescription>
            </Alert>

            <div className="space-y-2">
                <Button
                    onClick={handleVerifyPayment}
                    disabled={isVerifying || !transactionSignature.trim()}
                    className="w-full bg-[#7F39EC] hover:bg-[#6929D1]"
                    size="lg"
                >
                    {isVerifying ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Verifying...
                        </>
                    ) : (
                        <>Verify Payment Now</>
                    )}
                </Button>
                <Button
                    variant="outline"
                    onClick={handleClose}
                    className="w-full"
                >
                    Cancel
                </Button>
            </div>

            <p className="text-xs text-center text-gray-500">
                Your balance will be updated immediately after verification
            </p>
        </div>
    );

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="w-[92vw] max-w-md sm:max-w-lg md:max-w-xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl sm:text-2xl flex items-center gap-2">
                        <span>💳</span>
                        {step === 'amount' && 'Top Up with Solana'}
                        {step === 'instructions' && 'Payment Instructions'}
                        {step === 'verify' && 'Verify Payment'}
                    </DialogTitle>
                </DialogHeader>

                <div className="mt-4">
                    {step === 'amount' && renderAmountStep()}
                    {step === 'instructions' && renderInstructionsStep()}
                    {step === 'verify' && renderVerifyStep()}
                </div>
            </DialogContent>
        </Dialog>
    );
}

