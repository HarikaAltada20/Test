'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, Calendar, CreditCard, ArrowRight, Home, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrencyFromCents } from '@/lib/currency-utils';
import { formatDate } from '@/lib/date-utils';

interface SubscriptionData {
    id: string;
    status: string;
    planName: string;
    amount: number;
    currency: string;
    interval: string;
    currentPeriodStart: string; // Changed from Date to string
    currentPeriodEnd: string;   // Changed from Date to string
    nextBillingDate: string;    // Changed from Date to string
}

interface SubscriptionSuccessClientProps {
    sessionId: string;
    subscriptionData: SubscriptionData | null;
}

export function SubscriptionSuccessClient({
    sessionId,
    subscriptionData,
}: SubscriptionSuccessClientProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    // Auto-redirect after 30 seconds for better UX
    useEffect(() => {
        const timer = setTimeout(() => {
            router.push('/dashboard/billing');
        }, 30000);

        return () => clearTimeout(timer);
    }, [router]);

    const handleContinueToDashboard = () => {
        setIsLoading(true);
        router.push('/dashboard');
    };

    const handleManageSubscription = () => {
        setIsLoading(true);
        router.push('/dashboard/billing');
    };

    const getStatusBadgeColor = (status: string) => {
        switch (status) {
            case 'active':
                return 'bg-green-100 text-green-800';
            case 'trialing':
                return 'bg-blue-100 text-blue-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
            <div className="max-w-2xl w-full space-y-6">
                {/* Success Header */}
                <div className="text-center space-y-4">
                    <div className="flex justify-center">
                        <div className="bg-green-100 p-4 rounded-full">
                            <CheckCircle className="h-16 w-16 text-green-600" />
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900">
                        Payment Successful!
                    </h1>
                    <p className="text-lg text-gray-600">
                        Your subscription has been activated successfully
                    </p>
                </div>

                {/* Subscription Details Card */}
                <Card className="shadow-lg">
                    <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2">
                            <CreditCard className="h-5 w-5" />
                            {subscriptionData ? 'Subscription Details' : 'Payment Completed'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {subscriptionData ? (
                            <>
                                {/* Plan Information */}
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h3 className="font-semibold text-lg">{subscriptionData.planName}</h3>
                                    </div>
                                    <Badge className={getStatusBadgeColor(subscriptionData.status)}>
                                        {subscriptionData.status}
                                    </Badge>
                                </div>

                                {/* Payment Information */}
                                <div className="border-t pt-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-sm text-gray-600">Amount Charged</p>
                                            <p className="font-semibold">
                                                {formatCurrencyFromCents(subscriptionData.amount)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-600">Billing Cycle</p>
                                            <p className="font-semibold capitalize">
                                                {subscriptionData.interval}ly
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Billing Information */}
                                <div className="border-t pt-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="h-4 w-4 text-gray-500" />
                                            <div>
                                                <p className="text-sm text-gray-600">Current Period</p>
                                                <p className="font-medium">
                                                    {formatDate(new Date(subscriptionData.currentPeriodStart))} - {formatDate(new Date(subscriptionData.currentPeriodEnd))}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Calendar className="h-4 w-4 text-gray-500" />
                                            <div>
                                                <p className="text-sm text-gray-600">Next Billing Date</p>
                                                <p className="font-medium">
                                                    {formatDate(new Date(subscriptionData.nextBillingDate))}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Subscription ID for reference */}
                                <div className="border-t pt-4">
                                    <p className="text-sm text-gray-600">Subscription ID</p>
                                    <p className="font-mono text-sm bg-gray-100 p-2 rounded">
                                        {subscriptionData.id}
                                    </p>
                                </div>
                            </>
                        ) : (
                            /* Fallback when subscription details aren't available */
                            <div className="text-center py-6">
                                <div className="bg-green-100 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                                    <CheckCircle className="h-8 w-8 text-green-600" />
                                </div>
                                <h3 className="font-semibold text-lg mb-2">Payment Processed Successfully</h3>
                                <p className="text-gray-600 mb-4">
                                    Your subscription payment has been completed and your account will be updated shortly.
                                </p>
                                <div className="bg-blue-50 p-4 rounded-lg">
                                    <h4 className="font-semibold text-blue-800 mb-2">Your Plan Benefits:</h4>
                                    <ul className="text-sm text-blue-700 space-y-1">
                                        <li>• Access to all premium features</li>
                                        <li>• Enhanced contest creation tools</li>
                                        <li>• Priority customer support</li>
                                        <li>• Advanced analytics and insights</li>
                                    </ul>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* What's Next Section */}
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle>What's Next?</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-start gap-3">
                            <div className="bg-blue-100 p-2 rounded-full mt-1">
                                <ArrowRight className="h-4 w-4 text-blue-600" />
                            </div>
                            <div>
                                <h4 className="font-semibold">Start Creating Contests</h4>
                                <p className="text-gray-600 text-sm">
                                    Your new plan is now active. You can start creating contests with your upgraded features.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="bg-green-100 p-2 rounded-full mt-1">
                                <Settings className="h-4 w-4 text-green-600" />
                            </div>
                            <div>
                                <h4 className="font-semibold">Manage Your Subscription</h4>
                                <p className="text-gray-600 text-sm">
                                    You can update your payment method, change plans, or cancel anytime from your billing page.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-4">
                    <Button
                        onClick={handleContinueToDashboard}
                        disabled={isLoading}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                        <Home className="h-4 w-4 mr-2" />
                        Continue to Dashboard
                    </Button>
                    <Button
                        onClick={handleManageSubscription}
                        disabled={isLoading}
                        variant="outline"
                        className="flex-1"
                    >
                        <Settings className="h-4 w-4 mr-2" />
                        Manage Subscription
                    </Button>
                </div>

                {/* Footer Info */}
                <div className="text-center text-sm text-gray-500">
                    <p>Your subscription is now active and ready to use!</p>
                    <p className="mt-1">
                        Session ID: <span className="font-mono">{sessionId}</span>
                    </p>
                </div>
            </div>
        </div>
    );
} 