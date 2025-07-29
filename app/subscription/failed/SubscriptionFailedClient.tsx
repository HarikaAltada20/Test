'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    XCircle,
    RefreshCw,
    Home,
    CreditCard,
    AlertTriangle,
    HelpCircle,
    Mail,
    Phone
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { subscriptionPlans } from '@/constants/subscriptionPlans';

interface SubscriptionFailedClientProps {
    error?: string;
    sessionId?: string;
    reason?: string;
    userProfile: any;
    currentSubscription: any;
}

export function SubscriptionFailedClient({
    error,
    sessionId,
    reason,
    userProfile,
    currentSubscription
}: SubscriptionFailedClientProps) {
    const router = useRouter();
    const [isRetrying, setIsRetrying] = useState(false);

    const getErrorDetails = () => {
        switch (error) {
            case 'payment_cancelled':
                return {
                    title: 'Payment Cancelled',
                    message: 'You cancelled the payment process. No charges were made to your account.',
                    suggestions: [
                        'Try the subscription process again when ready',
                        'Contact support if you need help choosing a plan',
                        'Your current subscription remains unchanged'
                    ]
                };
            case 'payment_not_completed':
                return {
                    title: 'Payment Not Completed',
                    message: 'Your payment could not be processed. This might be due to insufficient funds, an expired card, or your bank declining the transaction.',
                    suggestions: [
                        'Check that your card has sufficient funds',
                        'Verify that your card details are correct',
                        'Contact your bank to ensure they are not blocking the transaction',
                        'Try using a different payment method'
                    ]
                };
            case 'session_not_found':
                return {
                    title: 'Session Expired',
                    message: 'The payment session has expired or could not be found. This usually happens if too much time has passed since you started the checkout process.',
                    suggestions: [
                        'Start a new subscription process',
                        'Clear your browser cache and try again',
                        'Make sure you are logged in to your account'
                    ]
                };
            case 'card_declined':
                return {
                    title: 'Card Declined',
                    message: 'Your card was declined by your bank. This could be due to insufficient funds, security restrictions, or an issue with the card.',
                    suggestions: [
                        'Check your card balance and available credit',
                        'Contact your bank to ensure they are not blocking the transaction',
                        'Try a different payment method',
                        'Verify that your billing address matches your card details'
                    ]
                };
            case 'invalid_card':
                return {
                    title: 'Invalid Card Details',
                    message: 'The card information provided is invalid. Please check all card details including the number, expiry date, and security code.',
                    suggestions: [
                        'Double-check your card number',
                        'Verify the expiry date is correct',
                        'Ensure the CVC/CVV code is accurate',
                        'Check that the billing address matches your card'
                    ]
                };
            default:
                return {
                    title: 'Payment Failed',
                    message: 'We encountered an issue processing your subscription payment. This could be due to various reasons including payment method issues or temporary service problems.',
                    suggestions: [
                        'Try again with the same payment method',
                        'Use a different payment method',
                        'Wait a few minutes and retry',
                        'Contact our support team if the issue persists'
                    ]
                };
        }
    };

    const errorDetails = getErrorDetails();

    const handleRetryPayment = () => {
        setIsRetrying(true);
        router.push('/dashboard/billing');
    };

    const handleContactSupport = () => {
        // You can customize this to open your support system
        window.open('mailto:support@gameofcreators.com?subject=Subscription Payment Issue', '_blank');
    };

    const handleGoHome = () => {
        router.push('/dashboard');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
            <div className="max-w-2xl w-full space-y-6">
                {/* Error Header */}
                <div className="text-center space-y-4">
                    <div className="flex justify-center">
                        <div className="bg-red-100 p-4 rounded-full">
                            <XCircle className="h-16 w-16 text-red-600" />
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900">
                        {errorDetails.title}
                    </h1>
                    <p className="text-lg text-gray-600">
                        {errorDetails.message}
                    </p>
                </div>

                {/* Error Details Card */}
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-red-600">
                            <AlertTriangle className="h-5 w-5" />
                            What happened?
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Alert>
                            <HelpCircle className="h-4 w-4" />
                            <AlertDescription>
                                {errorDetails.message}
                            </AlertDescription>
                        </Alert>

                        {/* Session Info if available */}
                        {sessionId && (
                            <div className="border-t pt-4">
                                <p className="text-sm text-gray-600 mb-2">Reference Information:</p>
                                <p className="font-mono text-sm bg-gray-100 p-2 rounded">
                                    Session ID: {sessionId}
                                </p>
                                {reason && (
                                    <p className="font-mono text-sm bg-gray-100 p-2 rounded mt-1">
                                        Reason: {reason}
                                    </p>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Suggestions Card */}
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle>How to fix this</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-2">
                            {errorDetails.suggestions.map((suggestion, index) => (
                                <li key={index} className="flex items-start gap-2">
                                    <div className="bg-blue-100 p-1 rounded-full mt-1">
                                        <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                                    </div>
                                    <span className="text-gray-700">{suggestion}</span>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>

                {/* Current Subscription Status */}
                {currentSubscription && (
                    <Card className="shadow-lg">
                        <CardHeader>
                            <CardTitle>Your Current Plan</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="font-semibold">
                                        {subscriptionPlans.find(p => p.id === currentSubscription.product_id)?.displayName || 'Current Plan'}
                                    </p>
                                    <p className="text-gray-600 text-sm">
                                        Your current subscription remains active
                                    </p>
                                </div>
                                <div className="text-green-600 font-semibold">
                                    Active
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Action Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Button
                        onClick={handleRetryPayment}
                        disabled={isRetrying}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isRetrying ? 'animate-spin' : ''}`} />
                        Try Again
                    </Button>

                    <Button
                        onClick={handleContactSupport}
                        variant="outline"
                        className="border-orange-600 text-orange-600 hover:bg-orange-50"
                    >
                        <Mail className="h-4 w-4 mr-2" />
                        Contact Support
                    </Button>

                    <Button
                        onClick={handleGoHome}
                        variant="outline"
                    >
                        <Home className="h-4 w-4 mr-2" />
                        Go to Dashboard
                    </Button>
                </div>

                {/* Support Information */}
                <Card className="shadow-lg bg-blue-50">
                    <CardContent className="pt-6">
                        <div className="text-center space-y-3">
                            <h3 className="font-semibold text-blue-900">Need Help?</h3>
                            <p className="text-blue-700 text-sm">
                                Our support team is here to help you resolve this issue
                            </p>
                            <div className="flex justify-center gap-6 text-sm">
                                <div className="flex items-center gap-1 text-blue-600">
                                    <Mail className="h-4 w-4" />
                                    support@gameofcreators.com
                                </div>
                                {/* <div className="flex items-center gap-1 text-blue-600">
                                    <Phone className="h-4 w-4" />
                                    1-800-GOVIRAL
                                </div> */}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
} 