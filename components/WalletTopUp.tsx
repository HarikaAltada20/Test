"use client";

import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
    Elements,
    CardElement,
    useElements,
    useStripe,
} from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, CreditCard, DollarSign } from 'lucide-react';
import { formatCurrencyFromCents } from '@/lib/currency-utils';
import { PaymentAnimation } from '@/components/ui/payment-success-animation';
import { handleFrontendPaymentFailure } from '@/lib/payment-utils-client';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface WalletTopUpProps {
    currentBalance: number;
    onBalanceUpdate: (newBalance: number) => void;
    onClose?: () => void;
    onTransactionUpdate?: () => void;
    onProcessingChange?: (isProcessing: boolean) => void;
}

const CheckoutForm = ({
    amount,
    onSuccess,
    onError,
    onProcessingChange
}: {
    amount: number;
    onSuccess: () => void;
    onError: (error: string) => void;
    onProcessingChange?: (isProcessing: boolean) => void;
}) => {
    const stripe = useStripe();
    const elements = useElements();
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingStep, setProcessingStep] = useState<'idle' | 'creating' | 'confirming' | 'polling'>('idle');
    const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);

    // Function to poll payment status
    const pollPaymentStatus = async (paymentIntentId: string): Promise<void> => {
        const maxAttempts = 30; // Poll for up to 30 seconds
        const interval = 1000; // Poll every 1 second

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                console.log(`🔄 Polling payment status (attempt ${attempt + 1}/${maxAttempts})`);

                const response = await fetch(`/api/payments/status?payment_intent_id=${paymentIntentId}`);
                const data = await response.json();

                console.log('📊 Payment status:', data);

                if (data.status === 'success') {
                    console.log('✅ Payment confirmed as successful');
                    onSuccess();
                    return;
                } else if (data.status === 'failed') {
                    console.log('❌ Payment confirmed as failed');
                    onError(data.message || 'Payment failed');
                    return;
                }

                // If status is still 'pending', continue polling
                console.log('⏳ Payment still pending, continuing to poll...');
                await new Promise(resolve => setTimeout(resolve, interval));
            } catch (error) {
                console.error('❌ Error polling payment status:', error);
                // Continue polling on error (might be temporary network issue)
            }
        }

        // If we've exhausted all attempts, consider it a timeout
        console.log('⏰ Payment status polling timed out');
        onError('Payment processing timed out. Please contact support if you were charged.');
    };

    // Handle frontend payment failures (before Stripe confirmation)
    const handleFrontendPaymentFailure = async (paymentIntentId: string, errorMessage: string) => {
        try {
            const response = await fetch('/api/payments/failure', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    paymentIntentId,
                    errorMessage,
                    source: 'frontend'
                })
            });

            if (!response.ok) {
                console.error('Failed to update payment failure status');
            }
        } catch (error) {
            console.error('Error updating payment failure status:', error);
        }
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!stripe || !elements) {
            return;
        }

        setIsProcessing(true);
        setProcessingStep('creating');
        onProcessingChange?.(true);

        try {
            // Create payment intent
            const response = await fetch('/api/payments/deposit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount }),
            });

            const { clientSecret, paymentIntentId: piId } = await response.json();

            if (!clientSecret) {
                throw new Error('Failed to create payment intent');
            }

            console.log('💳 Payment intent created:', piId);

            // Store payment intent ID for failure handling
            setPaymentIntentId(piId);

            // Confirm payment
            setProcessingStep('confirming');
            const { error: stripeError } = await stripe.confirmCardPayment(clientSecret, {
                payment_method: {
                    card: elements.getElement(CardElement)!,
                },
            });

            if (stripeError) {
                console.log('🔴 Stripe error detected:', stripeError.message);

                // Handle frontend failure - update transaction status to failed
                if (piId) {
                    console.log('📝 Updating transaction status to failed for payment intent:', piId);
                    await handleFrontendPaymentFailure(piId, stripeError.message || 'Payment failed');
                }

                onError(stripeError.message || 'Payment failed');
            } else {
                console.log('✅ Stripe payment confirmed, starting status polling...');
                // Start polling for payment status instead of showing immediate success
                setProcessingStep('polling');
                await pollPaymentStatus(piId);
            }
        } catch (error) {
            console.error('💥 Unexpected error in wallet top-up:', error);

            // Handle unexpected failures
            if (paymentIntentId) {
                await handleFrontendPaymentFailure(paymentIntentId, 'An unexpected error occurred');
            }

            onError('An unexpected error occurred');
        }

        setIsProcessing(false);
        setProcessingStep('idle');
        onProcessingChange?.(false);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="p-4 border rounded-lg bg-gray-50">
                <Label className="text-sm font-medium text-gray-700 mb-2 block">
                    Card Details
                </Label>
                <CardElement
                    options={{
                        style: {
                            base: {
                                fontSize: '16px',
                                color: '#424770',
                                '::placeholder': {
                                    color: '#aab7c4',
                                },
                            },
                        },
                    }}
                />
            </div>

            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-blue-600" />
                    <span className="font-medium text-blue-900">
                        Amount to charge: {formatDollarAmount(amount)}
                    </span>
                </div>
            </div>

            <Button
                type="submit"
                disabled={!stripe || isProcessing}
                className="w-full"
                size="lg"
            >
                {isProcessing ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {processingStep === 'creating' && 'Creating payment...'}
                        {processingStep === 'confirming' && 'Confirming payment...'}
                        {processingStep === 'polling' && 'Verifying payment...'}
                        {processingStep === 'idle' && 'Processing...'}
                    </>
                ) : (
                    <>
                        <CreditCard className="mr-2 h-4 w-4" />
                        Add {formatDollarAmount(amount)} to Wallet
                    </>
                )}
            </Button>
        </form>
    );
};

// Helper function to format dollar amounts (user input is already in dollars)
const formatDollarAmount = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
};

export function WalletTopUp({ currentBalance, onBalanceUpdate, onClose, onTransactionUpdate, onProcessingChange }: WalletTopUpProps) {
    const [amount, setAmount] = useState<number>(50); // Default $50
    const [showPaymentForm, setShowPaymentForm] = useState(false);
    const [showAnimation, setShowAnimation] = useState(false);
    const [animationType, setAnimationType] = useState<'success' | 'failure'>('success');
    const [animationAmount, setAnimationAmount] = useState<number>(0);
    const [errorMessage, setErrorMessage] = useState<string>('');

    const handleSuccess = async () => {
        console.log('🎉 WalletTopUp: Payment success callback triggered');

        // Store the amount for animation and close payment form
        setAnimationAmount(amount);
        setAnimationType('success');
        setShowPaymentForm(false);

        // Show success animation
        setShowAnimation(true);

        // Wait a moment for webhook to process, then refresh balance
        setTimeout(async () => {
            try {
                console.log('🔄 WalletTopUp: Fetching updated balance after payment...');
                const response = await fetch('/api/payments/balance');
                const data = await response.json();

                if (data.balance !== undefined) {
                    console.log('💰 WalletTopUp: Updating balance to:', data.balance);
                    onBalanceUpdate(data.balance);
                }
            } catch (error) {
                console.error('❌ WalletTopUp: Error fetching balance:', error);
            }

            // Refresh transaction history
            if (onTransactionUpdate) {
                console.log('🔄 WalletTopUp: Refreshing transaction history...');
                onTransactionUpdate();
            }
        }, 2000); // Wait 2 seconds for webhook to process
    };

    const handleError = (error: string) => {
        console.log('❌ WalletTopUp: Payment error:', error);

        // Store error details for animation
        setAnimationAmount(amount);
        setAnimationType('failure');
        setErrorMessage(error);
        setShowPaymentForm(false); // Close payment form but keep modal open

        // Show failure animation
        setShowAnimation(true);

        // Refresh transaction history even on failure to show failed transaction
        if (onTransactionUpdate) {
            console.log('🔄 WalletTopUp: Refreshing transaction history after failure...');
            setTimeout(() => {
                onTransactionUpdate();
            }, 1000); // Small delay to allow webhook processing
        }
    };

    const handleAnimationComplete = () => {
        setShowAnimation(false);

        if (animationType === 'success') {
            // On success: show success toast and close the modal
            toast.success('Payment successful! Your wallet has been topped up.');
            onClose?.(); // Close the modal/dialog
        } else {
            // On failure: show error toast but keep modal open for retry
            toast.error(`Payment failed: ${errorMessage}`);
            // Don't close the modal - user can retry
        }
    };

    const predefinedAmounts = [25, 50, 100, 200, 500];

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5" />
                        Top Up Wallet
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-green-800">
                                Current Balance
                            </span>
                            <span className="text-2xl font-bold text-green-900 transition-all duration-300 ease-in-out">
                                {formatCurrencyFromCents(currentBalance)}
                            </span>
                        </div>
                    </div>

                    {!showPaymentForm ? (
                        <div className="space-y-4">
                            <div className="space-y-3">
                                <Label className="text-sm font-medium">Quick amounts</Label>
                                <div className="grid grid-cols-3 gap-2">
                                    {predefinedAmounts.map((presetAmount) => (
                                        <Button
                                            key={presetAmount}
                                            variant={amount === presetAmount ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => setAmount(presetAmount)}
                                        >
                                            ${presetAmount}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="custom-amount">Or enter custom amount</Label>
                                <Input
                                    id="custom-amount"
                                    type="number"
                                    min="1"
                                    max="10000"
                                    value={amount}
                                    onChange={(e) => setAmount(Number(e.target.value))}
                                    placeholder="Enter amount"
                                />
                            </div>

                            <Button
                                onClick={() => setShowPaymentForm(true)}
                                className="w-full"
                                size="lg"
                                disabled={!amount || amount < 1}
                            >
                                Proceed to Payment
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-medium">Complete Payment</h3>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowPaymentForm(false)}
                                >
                                    Back
                                </Button>
                            </div>

                            <Elements stripe={stripePromise}>
                                <CheckoutForm
                                    amount={amount}
                                    onSuccess={handleSuccess}
                                    onError={handleError}
                                    onProcessingChange={onProcessingChange}
                                />
                            </Elements>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Payment Animation Overlay */}
            <PaymentAnimation
                isVisible={showAnimation}
                type={animationType}
                amount={animationAmount}
                error={errorMessage}
                onComplete={handleAnimationComplete}
            />
        </>
    );
} 