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
import { cn } from '@/lib/utils';

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

    // Calculate the card amount (what will actually be charged to the card)
    const totalAmountInCents = Math.round(amount * 100);
    const walletAmountInCents = walletAmount ? Math.round(walletAmount * 100) : 0;
    const cardAmountInCents = totalAmountInCents - walletAmountInCents;

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
                body.walletAmount = walletAmount; // Already in dollars
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Payment failed');
            }

            // For Stripe or split payments, confirm the payment
            if (result.clientSecret) {
                // Get card element and validate it exists
                const cardElement = elements.getElement(CardElement);

                if (!cardElement) {
                    console.error('❌ Card element not found - Stripe not properly initialized');
                    onError('Payment form not properly loaded. Please refresh and try again.');
                    setIsProcessing(false);
                    return;
                }

                const { error: stripeError } = await stripe.confirmCardPayment(result.clientSecret, {
                    payment_method: {
                        card: cardElement,
                    },
                });

                if (stripeError) {
                    console.error('💥 Stripe payment failed:', stripeError);
                    onError(stripeError.message || 'Payment failed');
                } else {
                    console.log('✅ Payment succeeded!');
                    onSuccess(result);
                }
            } else {
                // Wallet-only payment completed immediately
                console.log('✅ Wallet payment completed!');
                onSuccess(result);
            }
        } catch (error: any) {
            console.error('💥 Unexpected error in contest payment:', error);
            onError(error.message || 'An unexpected error occurred');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="p-4 border rounded-lg">
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

            <Button
                type="submit"
                disabled={!stripe}
                loading={isProcessing}
                loadingText="Processing Payment..."
                className="w-full"
                size="lg"
            >
                <CreditCard className="mr-2 h-4 w-4" />
                Charge Card {formatCurrencyFromCents(cardAmountInCents)}
            </Button>
        </form>
    );
};

// Wallet-only payment component
const WalletOnlyPayment = ({
    contestId,
    amount,
    commissionPercentage,
    isIncrease,
    isDecrease,
    onSuccess,
    onError
}: {
    contestId?: string;
    amount: number;
    commissionPercentage: number;
    isIncrease?: boolean;
    isDecrease?: boolean;
    onSuccess: (details: any) => void;
    onError: (error: string) => void;
}) => {
    const [isProcessing, setIsProcessing] = useState(false);
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
      const isDark=mode==="dark";
    const handleWalletPayment = async () => {
        setIsProcessing(true);

        try {
            const response = await fetch('/api/payments/contest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contestId,
                    amount,
                    paymentMethod: 'wallet',
                    commissionPercentage,
                    isIncrease: isIncrease || false,
                    isDecrease: isDecrease || false
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Wallet payment failed');
            }

            console.log('✅ Wallet payment completed!');
            onSuccess(result);
        } catch (error: any) {
            console.error('💥 Wallet payment error:', error);
            onError(error.message || 'Wallet payment failed');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="space-y-4">
            <div 
             className={cn(
                "p-4 border rounded-lg",
                isDark
                  ? "text-white border-gray-500"
                  : "border-gray-500 text-gray-800"
              )}>
                <div className="flex items-center gap-2 mb-2">
                    <Wallet className="h-5 w-5" />
                    <span className="font-medium">Wallet Payment</span>
                </div>
                <p 
                 className={cn(
                    "text-sm",
                    isDark
                      ? "text-white"
                      : "text-gray-900"
                  )}>
                    Your payment of {formatCurrencyFromCents(Math.round(amount * 100))} will be deducted from your wallet balance instantly.
                </p>
            </div>

            <Button
                onClick={handleWalletPayment}
                loading={isProcessing}
                loadingText="Processing Payment..."
               
                className={cn(
                    "w-full text-md rounded-full",
                    isDark
                      ? "bg-[#7F39EC] py-3"
                      : " bg-[#D9C0FF61] py-4 text-[#7F39EC] "
                  )}
                size="lg"
            >
                <Wallet className="h-4 w-4" />
                Pay from Wallet {formatCurrencyFromCents(Math.round(amount * 100))}
            </Button>
        </div>
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

        // Update parent component
        onPaymentError(error);
    };

    const handleAnimationComplete = () => {
        setShowAnimation(false);
        setErrorMessage('');
    };

    // Calculate derived values
    const canUseWallet = walletBalance >= totalAmountInCents;
    const needsStripe = paymentMethod === 'stripe' || paymentMethod === 'split';
    const stripeAmount = needsStripe ? totalAmountInCents - (paymentMethod === 'split' ? walletAmount : 0) : 0;
    const isDark = mode === "dark";
    return (
        <Elements stripe={stripePromise}>
            <div className="w-full max-w-2xl mx-auto">
                <div>
                    <CardTitle className="flex text-xl items-center gap-2">
                        {/* <DollarSign className="h-5 w-5" /> */}
                        Contest Payment
                    </CardTitle>
                </div>
                <div className="mt-3 space-y-4">
                    {/* Contest Summary */}
                    <div className="px-1">
                        <h3 className="font-semibold mb-2">Contest: {contestTitle}</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span>{isIncrease ? "Prize Pool Increased:" : "Prize Pool:"}</span>
                                <span className="font-medium">{formatCurrencyFromCents(prizePoolInCents)}</span>
                            </div>
                            <div className="flex text-sm justify-between">
                                <span>Platform Commission ({commissionPercentage}%):</span>
                                <span className="font-medium">{formatCurrencyFromCents(commissionAmountInCents)}</span>
                            </div>
                            <Separator />
                            <div className="flex text-md justify-between font-semibold">
                                <span>Total Amount:</span>
                                <span>{formatCurrencyFromCents(totalAmountInCents)}</span>
                            </div>

                            {/* Payment Breakdown - Show when using card or split payment */}
                            {(paymentMethod === 'stripe' || paymentMethod === 'split') && (
                                <>
                                    <Separator className="my-2" />
                                    <div className="text-sm font-medium mb-1">Payment Breakdown:</div>

                                    {paymentMethod === 'split' && walletAmount > 0 && (
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
                                                {paymentMethod === 'split' ? 'From Card:' : 'Card Payment:'}
                                            </span>
                                            <span 
                                             className={cn(
                                                "font-medium",
                                                isDark ? "text-white" : "text-gray-900"
                                              )}>{formatCurrencyFromCents(stripeAmount)}</span>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Wallet Balance Display */}
                    <div className="p-4 rounded-lg border border-gray-500">
                        <div className="flex justify-between items-center">
                            <span 
                             className={cn(
                                "flex items-center gap-2",
                                isDark ? "text-white" : "text-gray-800"
                              )}>
                                <Wallet className="h-4 w-4" />
                                Available Wallet Balance:
                            </span>
                            {isLoadingBalance ? (
                                <div className="flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span className="text-sm">Fetching balance...</span>
                                </div>
                            ) : (
                                <span 
                                 className={cn(
                                    "text-lg font-semibold",
                                    isDark ? "text-white" : "text-gray-900"
                                  )}>
                                    {formatCurrencyFromCents(walletBalance)}
                                </span>
                            )}
                        </div>
                    </div>

                    {!showPaymentForm ? (
                        <div className="space-y-6">
                            {/* Payment Method Selection */}
                            <div className="space-y-4">
                                <Label className="text-base font-medium">Choose Payment Method</Label>
                                {isLoadingBalance && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>Loading payment options...</span>
                                    </div>
                                )}

                                <RadioGroup
                                    value={paymentMethod}
                                    onValueChange={handlePaymentMethodChange}
                                    disabled={disabled || isLoadingBalance}
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
                                            <p className="text-sm text-gray-500 mt-1">
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
                                                <p className="text-sm text-gray-500 mt-1">
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
                            <div
                            className={cn(
                                " p-4 rounded-lg space-y-2",
                                isDark ? "bg-[#100A33]" : "bg-gray-50"
                              )}>
                                <h4 className="font-medium">Payment Summary</h4>
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
                            <button
                                onClick={() => setShowPaymentForm(true)}
                                className={cn(
                                    "w-full rounded-full text-md py-3",
                                    isDark
                                      ? "bg-[#7F39EC] py-3"
                                      : " bg-[#D9C0FF61] py-4 text-[#7F39EC] "
                                  )}
                                disabled={disabled || isLoadingBalance}
                            >
                                {isLoadingBalance ? 'Loading...' : (needsStripe ? 'Proceed to Payment' : 'Complete Payment')}
                            </button>

                            {/* Info Alert */}
                            <Alert className='bg-[#D9C0FF26] border border-[#7F39EC]'>
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
                                    className={cn(
                                        "border",
                                        isDark
                                          ? "text-white border-gray-400"
                                          : "border-[#4A00BE] bg-white text-[#4A00BE]"
                                      )}
                                >
                                    Back
                                </Button>
                            </div>

                            {/* Wallet-only payment */}
                            {paymentMethod === 'wallet' ? (
                                <WalletOnlyPayment
                                    contestId={contestId}
                                    amount={totalAmountInDollars}
                                    commissionPercentage={commissionPercentage}
                                    isIncrease={isIncrease}
                                    isDecrease={isDecrease}
                                    onSuccess={handlePaymentSuccess}
                                    onError={handlePaymentError}
                                />
                            ) : (
                                /* Stripe or Split payment */
                                <StripeCheckoutForm
                                    amount={totalAmountInDollars}
                                    contestId={contestId}
                                    paymentMethod={paymentMethod}
                                    walletAmount={paymentMethod === 'split' ? walletAmount / 100 : undefined}
                                    commissionPercentage={commissionPercentage}
                                    isIncrease={isIncrease}
                                    isDecrease={isDecrease}
                                    onSuccess={handlePaymentSuccess}
                                    onError={handlePaymentError}
                                />
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Payment Animation Overlay */}
            <PaymentAnimation
                isVisible={showAnimation}
                type={animationType}
                amount={animationAmount}
                error={errorMessage}
                onComplete={handleAnimationComplete}
            />
        </Elements>
    );
} 