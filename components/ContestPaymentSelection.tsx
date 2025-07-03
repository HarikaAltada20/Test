"use client";

import React, { useState, useEffect } from 'react';
import { Elements, CardElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import {
    Wallet,
    CreditCard,
    DollarSign,
    AlertCircle,
    CheckCircle2,
    Loader2
} from 'lucide-react';
import { formatCurrencyFromCents } from '@/lib/currency-utils';
import { PaymentAnimation } from '@/components/ui/payment-success-animation';
import { handleFrontendPaymentFailure } from '@/lib/payment-utils-client';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface ContestPaymentSelectionProps {
    contestAmount: number; // Prize pool amount in dollars
    contestTitle: string;
    contestId?: string;
    commissionPercentage: number; // Commission percentage from user's plan
    onPaymentSuccess: (paymentDetails: any) => void;
    onPaymentError: (error: string) => void;
    disabled?: boolean;
    isIncrease?: boolean; // Budget increase
    isDecrease?: boolean; // Budget decrease
}

const StripeCheckoutForm = ({
    amount,
    contestId,
    paymentMethod,
    walletAmount,
    commissionPercentage,
    isIncrease,
    isDecrease,
    onSuccess,
    onError
}: {
    amount: number;
    contestId?: string;
    paymentMethod: string;
    walletAmount?: number;
    commissionPercentage: number;
    isIncrease?: boolean;
    isDecrease?: boolean;
    onSuccess: (details: any) => void;
    onError: (error: string) => void;
}) => {
    const stripe = useStripe();
    const elements = useElements();
    const [isProcessing, setIsProcessing] = useState(false);
    const [paymentIntentId, setPaymentIntentId] = useState<string>('');

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!stripe || !elements) {
            return;
        }

        setIsProcessing(true);

        try {
            // Get the API endpoint response based on payment method
            let endpoint = '/api/payments/contest';
            let body: any = {
                contestId,
                amount,
                paymentMethod,
                commissionPercentage: commissionPercentage,
                isIncrease: isIncrease || false,
                isDecrease: isDecrease || false
            };

            if (paymentMethod === 'split' && walletAmount) {
                body.walletAmount = walletAmount / 100; // Convert cents to dollars for API
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                onError(result.error || 'Payment processing failed');
                setIsProcessing(false);
                return;
            }

            // If this was a wallet-only payment, we're done
            if (paymentMethod === 'wallet') {
                onSuccess(result);
                setIsProcessing(false);
                return;
            }

            // Store payment intent ID for failure handling
            if (result.paymentIntentId) {
                setPaymentIntentId(result.paymentIntentId);
            }

            // For Stripe or split payments, confirm the payment
            if (result.clientSecret) {
                const { error: stripeError } = await stripe.confirmCardPayment(result.clientSecret, {
                    payment_method: {
                        card: elements.getElement(CardElement)!,
                    },
                });

                if (stripeError) {
                    console.log('🔴 Contest payment Stripe error:', stripeError.message);

                    // Handle frontend failure - update transaction status to failed
                    if (result.paymentIntentId) {
                        console.log('📝 Updating contest payment transaction to failed:', result.paymentIntentId);
                        await handleFrontendPaymentFailure(result.paymentIntentId, stripeError.message || 'Payment failed');
                    }

                    onError(stripeError.message || 'Payment failed');
                } else {
                    onSuccess(result);
                }
            }
        } catch (error) {
            console.error('💥 Unexpected error in contest payment:', error);

            // Handle unexpected failures
            if (paymentIntentId) {
                await handleFrontendPaymentFailure(paymentIntentId, 'An unexpected error occurred');
            }

            onError('An unexpected error occurred');
        }

        setIsProcessing(false);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {(paymentMethod === 'stripe' || paymentMethod === 'split') && (
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
            )}

            <Button
                type="submit"
                disabled={!stripe || isProcessing}
                className="w-full"
                size="lg"
            >
                {isProcessing ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing Payment...
                    </>
                ) : (
                    <>
                        <CreditCard className="mr-2 h-4 w-4" />
                        Complete Payment
                    </>
                )}
            </Button>
        </form>
    );
};

export function ContestPaymentSelection({
    contestAmount,
    contestTitle,
    contestId,
    commissionPercentage,
    onPaymentSuccess,
    onPaymentError,
    disabled = false,
    isIncrease = false,
    isDecrease = false
}: ContestPaymentSelectionProps) {
    // Calculate commission and total amounts
    const prizePoolInCents = Math.round(contestAmount * 100);
    const commissionAmountInCents = Math.round(prizePoolInCents * (commissionPercentage / 100));
    const totalAmountInCents = prizePoolInCents + commissionAmountInCents;
    const totalAmountInDollars = totalAmountInCents / 100;

    const [walletBalance, setWalletBalance] = useState<number>(0);
    const [isLoadingBalance, setIsLoadingBalance] = useState(true);
    const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'stripe' | 'split'>('wallet');
    const [walletAmount, setWalletAmount] = useState<number>(0);
    const [showPaymentForm, setShowPaymentForm] = useState(false);
    const [showAnimation, setShowAnimation] = useState(false);
    const [animationType, setAnimationType] = useState<'success' | 'failure'>('success');
    const [animationAmount, setAnimationAmount] = useState<number>(0);
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [defaultMethodSet, setDefaultMethodSet] = useState(false);

    // Fetch wallet balance on component mount
    useEffect(() => {
        const fetchBalance = async () => {
            try {
                const response = await fetch('/api/payments/balance');
                const data = await response.json();
                if (data.balance !== undefined) {
                    setWalletBalance(data.balance); // Balance is in cents
                }
            } catch (error) {
                console.error('Error fetching wallet balance:', error);
            } finally {
                setIsLoadingBalance(false);
            }
        };

        fetchBalance();
    }, []);

    // Smart default payment method selection based on wallet balance
    useEffect(() => {
        if (!isLoadingBalance && !defaultMethodSet) {
            let defaultMethod: 'wallet' | 'stripe' | 'split' = 'stripe';

            if (walletBalance >= totalAmountInCents) {
                // Sufficient wallet balance - default to wallet
                defaultMethod = 'wallet';
            } else if (walletBalance > 0) {
                // Some wallet balance but insufficient - default to split
                defaultMethod = 'split';
            } else {
                // No wallet balance - default to stripe
                defaultMethod = 'stripe';
            }

            setPaymentMethod(defaultMethod);
            setDefaultMethodSet(true);
        }
    }, [isLoadingBalance, walletBalance, totalAmountInCents, defaultMethodSet]);

    // Auto-set wallet amount for split payment when switching to it
    useEffect(() => {
        if (paymentMethod === 'split') {
            const maxFromWallet = Math.min(walletBalance, totalAmountInCents);
            setWalletAmount(maxFromWallet);
        } else if (paymentMethod === 'wallet') {
            setWalletAmount(totalAmountInCents);
        } else {
            setWalletAmount(0);
        }
    }, [paymentMethod, walletBalance, totalAmountInCents]);

    const handlePaymentMethodChange = (value: string) => {
        setPaymentMethod(value as 'wallet' | 'stripe' | 'split');
    };

    const handleWalletAmountChange = (value: number) => {
        const valueInCents = Math.round(value * 100);
        const maxWallet = Math.min(walletBalance, totalAmountInCents);

        if (valueInCents >= 0 && valueInCents <= maxWallet) {
            setWalletAmount(valueInCents);
        }
    };

    const handlePaymentSuccess = (paymentDetails: any) => {
        // Store the amount for animation
        setAnimationAmount(contestAmount);
        setAnimationType('success');

        // Close payment form and show success animation
        setShowPaymentForm(false);
        setShowAnimation(true);

        // Update parent component
        onPaymentSuccess(paymentDetails);
    };

    const handlePaymentError = (error: string) => {
        // Store error details for animation
        setAnimationAmount(contestAmount);
        setAnimationType('failure');
        setErrorMessage(error);

        // Close payment form but keep the main component open
        setShowPaymentForm(false);

        // Show failure animation
        setShowAnimation(true);

        // Also notify parent component
        onPaymentError(error);
    };

    const handleAnimationComplete = () => {
        setShowAnimation(false);

        if (animationType === 'success') {
            // On success: show success toast
            toast.success('Contest payment successful! Your contest has been submitted for review.');
            // Parent component should handle any navigation or modal closing
        } else {
            // On failure: show error toast but keep component open for retry
            toast.error(`Payment failed: ${errorMessage}`);
            // Don't close anything - user can retry by clicking the payment button again
        }
    };

    const stripeAmount = totalAmountInCents - walletAmount;
    const canUseWallet = walletBalance >= totalAmountInCents;
    const needsStripe = stripeAmount > 0;

    if (isLoadingBalance) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    <span>Loading payment options...</span>
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5" />
                        Contest Payment
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Contest Details */}
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <h4 className="font-semibold text-blue-900 mb-2">{contestTitle}</h4>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-blue-700">
                                    {isIncrease ? "Prize Pool Increase:" : "Prize Pool:"}
                                </span>
                                <span className="text-lg font-semibold text-blue-900">
                                    {formatCurrencyFromCents(prizePoolInCents)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-blue-700">
                                    Commission ({commissionPercentage}%){isIncrease ? " on increase:" : ":"}
                                </span>
                                <span className="text-lg font-semibold text-blue-900">
                                    {formatCurrencyFromCents(commissionAmountInCents)}
                                </span>
                            </div>
                            <hr className="border-blue-300" />
                            <div className="flex items-center justify-between">
                                <span className="text-blue-800 font-semibold">
                                    {isIncrease ? "Additional Payment:" : "Total Amount:"}
                                </span>
                                <span className="text-xl font-bold text-blue-900">
                                    {formatCurrencyFromCents(totalAmountInCents)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Wallet Balance */}
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <div className="flex items-center justify-between">
                            <span className="text-green-700 flex items-center gap-2">
                                <Wallet className="h-4 w-4" />
                                Available Wallet Balance:
                            </span>
                            <span className="text-lg font-semibold text-green-900">
                                {formatCurrencyFromCents(walletBalance)}
                            </span>
                        </div>
                    </div>

                    {!showPaymentForm ? (
                        <div className="space-y-6">
                            {/* Payment Method Selection */}
                            <div className="space-y-4">
                                <Label className="text-base font-medium">Choose Payment Method</Label>

                                <RadioGroup
                                    value={paymentMethod}
                                    onValueChange={handlePaymentMethodChange}
                                    disabled={disabled}
                                >
                                    {/* Wallet Payment Option */}
                                    <div className="flex items-center space-x-2 p-4 border rounded-lg">
                                        <RadioGroupItem
                                            value="wallet"
                                            id="wallet"
                                            disabled={!canUseWallet || disabled}
                                        />
                                        <div className="flex-1">
                                            <Label
                                                htmlFor="wallet"
                                                className={`flex items-center gap-2 cursor-pointer ${!canUseWallet ? 'text-gray-400' : ''}`}
                                            >
                                                <Wallet className="h-4 w-4" />
                                                Pay from Wallet
                                                {canUseWallet && (
                                                    <Badge variant="secondary" className="ml-2">
                                                        Instant
                                                    </Badge>
                                                )}
                                            </Label>
                                            <p className="text-sm text-gray-600 mt-1">
                                                {canUseWallet
                                                    ? `Pay ${formatCurrencyFromCents(totalAmountInCents)} from your wallet balance`
                                                    : `Insufficient balance. Need ${formatCurrencyFromCents(totalAmountInCents - walletBalance)} more.`
                                                }
                                            </p>
                                        </div>
                                    </div>

                                    {/* Stripe Payment Option */}
                                    <div className="flex items-center space-x-2 p-4 border rounded-lg">
                                        <RadioGroupItem value="stripe" id="stripe" disabled={disabled} />
                                        <div className="flex-1">
                                            <Label htmlFor="stripe" className="flex items-center gap-2 cursor-pointer">
                                                <CreditCard className="h-4 w-4" />
                                                Pay with Credit Card
                                            </Label>
                                            <p className="text-sm text-gray-600 mt-1">
                                                Pay {formatCurrencyFromCents(totalAmountInCents)} with your credit card
                                            </p>
                                        </div>
                                    </div>

                                    {/* Split Payment Option */}
                                    {walletBalance > 0 && walletBalance < totalAmountInCents && (
                                        <div className="flex items-center space-x-2 p-4 border rounded-lg">
                                            <RadioGroupItem value="split" id="split" disabled={disabled} />
                                            <div className="flex-1">
                                                <Label htmlFor="split" className="flex items-center gap-2 cursor-pointer">
                                                    <div className="flex">
                                                        <Wallet className="h-4 w-4" />
                                                        <CreditCard className="h-4 w-4 -ml-1" />
                                                    </div>
                                                    Split Payment
                                                    <Badge variant="outline" className="ml-2">
                                                        Recommended
                                                    </Badge>
                                                </Label>
                                                <p className="text-sm text-gray-600 mt-1">
                                                    Pay {formatCurrencyFromCents(walletAmount)} from wallet + {formatCurrencyFromCents(stripeAmount)} from card
                                                </p>

                                                {paymentMethod === 'split' && (
                                                    <div className="mt-3 space-y-2">
                                                        <Label htmlFor="wallet-amount" className="text-xs">
                                                            Wallet Amount (max: {formatCurrencyFromCents(Math.min(walletBalance, totalAmountInCents))})
                                                        </Label>
                                                        <Input
                                                            id="wallet-amount"
                                                            type="number"
                                                            value={(walletAmount / 100).toFixed(2)}
                                                            onChange={(e) => handleWalletAmountChange(parseFloat(e.target.value) || 0)}
                                                            min="0"
                                                            max={(Math.min(walletBalance, totalAmountInCents) / 100).toFixed(2)}
                                                            step="0.01"
                                                            className="text-sm"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </RadioGroup>
                            </div>

                            {/* Payment Summary */}
                            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                                <h4 className="font-medium text-gray-900">Payment Summary</h4>
                                <Separator />

                                {walletAmount > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="flex items-center gap-1">
                                            <Wallet className="h-3 w-3" />
                                            From Wallet:
                                        </span>
                                        <span className="font-medium">{formatCurrencyFromCents(walletAmount)}</span>
                                    </div>
                                )}

                                {stripeAmount > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="flex items-center gap-1">
                                            <CreditCard className="h-3 w-3" />
                                            From Card:
                                        </span>
                                        <span className="font-medium">{formatCurrencyFromCents(stripeAmount)}</span>
                                    </div>
                                )}

                                <Separator />
                                <div className="flex justify-between font-semibold">
                                    <span>Total:</span>
                                    <span>{formatCurrencyFromCents(totalAmountInCents)}</span>
                                </div>
                            </div>

                            {/* Action Button */}
                            <Button
                                onClick={() => setShowPaymentForm(true)}
                                className="w-full"
                                size="lg"
                                disabled={disabled}
                            >
                                {needsStripe ? 'Proceed to Payment' : 'Complete Payment'}
                            </Button>

                            {/* Info Alert */}
                            <Alert>
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                    Your contest will be submitted for admin review after successful payment.
                                    Funds will be held securely until the contest is completed.
                                </AlertDescription>
                            </Alert>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-medium">Complete Payment</h3>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowPaymentForm(false)}
                                    disabled={disabled}
                                >
                                    Back
                                </Button>
                            </div>

                            <Elements stripe={stripePromise}>
                                <StripeCheckoutForm
                                    amount={totalAmountInDollars}
                                    contestId={contestId}
                                    paymentMethod={paymentMethod}
                                    walletAmount={paymentMethod === 'split' ? walletAmount : undefined}
                                    commissionPercentage={commissionPercentage}
                                    isIncrease={isIncrease}
                                    isDecrease={isDecrease}
                                    onSuccess={handlePaymentSuccess}
                                    onError={handlePaymentError}
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