"use client";

import React, { useState, useEffect, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { SubscriptionUpgradeModal } from './SubscriptionUpgradeModal';
import { toast } from 'sonner';
import {
    Crown,
    Star,
    Zap,
    Trophy,
    Calendar,
    ExternalLink,
    CreditCard,
    Check,
    AlertTriangle,
    Loader2,
    TrendingUp,
    Clock,
    Gift,
    Shield
} from 'lucide-react';
import { formatCurrencyFromCents } from '@/lib/currency-utils';
import { subscriptionPlans } from '@/constants/subscriptionPlans';
import type { UserSubscription, SubscriptionPlan } from '@/lib/subscription-types';
import { useRouter, useSearchParams } from 'next/navigation';

export const SubscriptionManagement = memo(function SubscriptionManagement() {

    const searchParams = useSearchParams();
    const [currentSubscription, setCurrentSubscription] = useState<UserSubscription | null>(null);
    const [currentPlan, setCurrentPlan] = useState<SubscriptionPlan | null>(null);
    const [isLoading, setIsLoading] = useState(true); // Start with loading true
    const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
    const [selectedTargetPlan, setSelectedTargetPlan] = useState<SubscriptionPlan | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingPlanId, setProcessingPlanId] = useState<string | null>(null);
    const [hasProcessedSuccess, setHasProcessedSuccess] = useState(false);
    const [hasInitialFetch, setHasInitialFetch] = useState(false);

    // Handle checkout success - with protection against infinite loops
    useEffect(() => {
        const success = searchParams.get('success');
        const sessionId = searchParams.get('session_id');

        // Only process once per session and if we haven't already processed
        if (success === 'true' && sessionId && !hasProcessedSuccess) {
            console.log('🎉 Payment successful, refreshing subscription data...');
            setHasProcessedSuccess(true);

            // Clear URL parameters to prevent refresh loops
            const newUrl = window.location.pathname;
            window.history.replaceState({}, '', newUrl);

            // Refresh subscription data after a short delay to allow webhook processing
            const refreshWithDelay = async () => {
                try {
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    await fetchCurrentSubscription();
                    toast.success('Subscription updated successfully!');
                } catch (error) {
                    console.error('Error refreshing subscription:', error);
                }
            };

            refreshWithDelay();
        }
    }, [searchParams, hasProcessedSuccess]);

    // Fetch subscription data immediately on mount
    useEffect(() => {
        fetchCurrentSubscription();
    }, []); // Only run once on mount

    const fetchCurrentSubscription = async () => {
        try {
            // Prevent duplicate calls if already loading
            if (isLoading && hasInitialFetch) {
                console.log('Subscription fetch already in progress, skipping...');
                return;
            }

            setIsLoading(true);
            setHasInitialFetch(true);
            console.log('Fetching current subscription...');

            const response = await fetch('/api/subscriptions/current');
            const result = await response.json();

            if (response.ok) {
                setCurrentSubscription(result.subscription);
                setCurrentPlan(result.plan);
                console.log('Subscription data updated successfully');
            } else {
                console.error('Failed to fetch subscription:', result.error);
                // Even if there's no subscription, we should show the plans
                setCurrentSubscription(null);
                setCurrentPlan(null);
            }
        } catch (error) {
            console.error('Error fetching subscription:', error);
            // Even if there's an error, we should show the plans
            setCurrentSubscription(null);
            setCurrentPlan(null);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpgradeClick = (targetPlan: SubscriptionPlan) => {
        if (!currentPlan) return;

        // For free plan users going to paid plans, bypass the modal and subscribe directly
        if (isOnFreePlan() && targetPlan.price > 0) {
            handleSubscribe(targetPlan.id);
            return;
        }

        // For all other cases, show the upgrade modal
        setSelectedTargetPlan(targetPlan);
        setUpgradeModalOpen(true);
    };

    const handleCustomerPortal = async () => {
        try {
            setIsProcessing(true);
            const response = await fetch('/api/subscriptions/portal', {
                method: 'POST'
            });
            const result = await response.json();

            if (response.ok && result.portalUrl) {
                window.open(result.portalUrl, '_blank');
            } else {
                toast.error(result.error || 'Failed to open customer portal');
            }
        } catch (error) {
            console.error('Error opening customer portal:', error);
            toast.error('Failed to open customer portal');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSubscribe = async (productId: string) => {
        try {
            setProcessingPlanId(productId);
            setIsProcessing(true);

            // Get the plan and extract the monthly price ID
            const plan = subscriptionPlans.find(p => p.id === productId);
            if (!plan) {
                toast.error('Plan not found');
                return;
            }

            const priceId = plan.prices?.monthly?.id;
            if (!priceId) {
                toast.error('Price ID not found for plan');
                return;
            }

            const response = await fetch('/api/subscriptions/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId, priceId })
            });

            const result = await response.json();

            if (response.ok) {
                if (result.checkoutUrl) {
                    window.location.href = result.checkoutUrl;
                } else {
                    toast.success(result.message);
                    fetchCurrentSubscription(); // Refresh data
                }
            } else {
                toast.error(result.error || 'Failed to create subscription');
            }
        } catch (error) {
            console.error('Error creating subscription:', error);
            toast.error('Failed to create subscription');
        } finally {
            setIsProcessing(false);
            setProcessingPlanId(null);
        }
    };

    const getPlanIcon = (planName: string | undefined) => {
        if (!planName) return <Trophy className="h-5 w-5" />;
        const name = planName.toUpperCase();
        if (name === 'CHAMPION' || name === 'CHAMPION PLAN') return <Crown className="h-5 w-5" />;
        if (name === 'BUILDER' || name === 'BUILDER PLAN') return <Star className="h-5 w-5" />;
        if (name === 'STARTER' || name === 'STARTER PLAN') return <Zap className="h-5 w-5" />;
        if (name === 'EXPLORER' || name === 'EXPLORER PLAN' || name === 'FREE') return <Trophy className="h-5 w-5" />;
        if (name === 'BASIC') return <Zap className="h-5 w-5" />;
        if (name === 'PREMIUM') return <Star className="h-5 w-5" />;
        if (name === 'ENTERPRISE') return <Crown className="h-5 w-5" />;
        return <Trophy className="h-5 w-5" />;
    };

    const getPlanColor = (planName: string | undefined) => {
        if (!planName) return 'from-gray-500 to-gray-600';
        const name = planName.toUpperCase();
        if (name === 'CHAMPION' || name === 'CHAMPION PLAN') return 'from-yellow-500 to-orange-600';
        if (name === 'BUILDER' || name === 'BUILDER PLAN') return 'from-purple-500 to-blue-600';
        if (name === 'STARTER' || name === 'STARTER PLAN') return 'from-orange-500 to-red-600';
        if (name === 'EXPLORER' || name === 'EXPLORER PLAN' || name === 'FREE') return 'from-green-500 to-teal-600';
        if (name === 'BASIC') return 'from-blue-500 to-cyan-600';
        if (name === 'PREMIUM') return 'from-purple-500 to-pink-600';
        if (name === 'ENTERPRISE') return 'from-red-500 to-orange-600';
        return 'from-gray-500 to-gray-600';
    };

    const canUpgrade = (targetPlan: SubscriptionPlan) => {
        return currentPlan && targetPlan.price > currentPlan.price;
    };

    const canDowngrade = (targetPlan: SubscriptionPlan) => {
        return currentPlan && targetPlan.price < currentPlan.price;
    };

    // Check if user is on free plan (price === 0)
    const isOnFreePlan = () => {
        return currentPlan && currentPlan.price === 0;
    };

    // For free plan users, we should show 'Subscribe' for paid plans, not 'Upgrade'
    const shouldShowSubscribe = (targetPlan: SubscriptionPlan) => {
        // Show subscribe if no current subscription OR user is on free plan going to paid plan
        return !currentSubscription || (isOnFreePlan() && targetPlan.price > 0);
    };

    // Show loading state while fetching subscription data
    if (isLoading) {
        return (
            <div className="space-y-8">
                {/* Current Subscription Status Skeleton */}
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-48" />
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <Skeleton className="h-12 w-12 rounded-lg" />
                                <div>
                                    <Skeleton className="h-6 w-32 mb-2" />
                                    <Skeleton className="h-4 w-24" />
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Skeleton className="h-6 w-16" />
                                <Skeleton className="h-10 w-32" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Available Plans Skeleton */}
                <div>
                    <div className="flex items-center justify-between mb-6">
                        <Skeleton className="h-8 w-48" />
                        <Skeleton className="h-6 w-32" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[1, 2, 3, 4].map((i) => (
                            <Card key={i}>
                                <CardHeader className="text-center">
                                    <Skeleton className="h-12 w-12 rounded-xl mx-auto mb-3" />
                                    <Skeleton className="h-6 w-24 mx-auto mb-2" />
                                    <Skeleton className="h-8 w-20 mx-auto mb-2" />
                                    <Skeleton className="h-4 w-32 mx-auto" />
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {[1, 2, 3, 4].map((j) => (
                                        <div key={j} className="flex items-center gap-2">
                                            <Skeleton className="h-4 w-4" />
                                            <Skeleton className="h-4 w-32" />
                                        </div>
                                    ))}
                                    <Separator />
                                    <Skeleton className="h-10 w-full" />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Current Subscription Status */}
            {currentSubscription && currentPlan && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Shield className="h-5 w-5 text-green-600" />
                            Current Subscription
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-lg bg-gradient-to-r ${getPlanColor(currentPlan.name)} text-white`}>
                                    {getPlanIcon(currentPlan.name)}
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold">{currentPlan.displayName || currentPlan.name}</h3>
                                    <p className="text-gray-600">
                                        {formatCurrencyFromCents(currentPlan.price)}
                                        {currentPlan.price > 0 ? '/month' : ''}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {currentSubscription.status === 'active' && (
                                    <Badge className="bg-green-100 text-green-800">Active</Badge>
                                )}
                                {currentPlan.price > 0 && (
                                    <Button
                                        variant="outline"
                                        onClick={handleCustomerPortal}
                                        disabled={isProcessing}
                                    >
                                        {isProcessing ? (
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        ) : (
                                            <ExternalLink className="h-4 w-4 mr-2" />
                                        )}
                                        Manage Billing
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Available Plans */}
            <div>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold">Available Plans</h2>
                    {!currentSubscription && (
                        <Badge className="bg-green-100 text-green-800">
                            <Gift className="h-3 w-3 mr-1" />
                            Start with our free plan
                        </Badge>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {subscriptionPlans.map((plan) => {
                        const isCurrentPlan = currentPlan?.id === plan.id;
                        const canUpgradeToThis = canUpgrade(plan);
                        const canDowngradeToThis = canDowngrade(plan);

                        return (
                            <Card
                                key={plan.id}
                                className={`relative flex flex-col ${isCurrentPlan ? 'ring-2 ring-green-500' : ''}`}
                            >
                                {isCurrentPlan && (
                                    <div className="absolute -top-3 right-4">
                                        <Badge className="bg-green-600 text-white">Current Plan</Badge>
                                    </div>
                                )}

                                <CardHeader className="text-center">
                                    <div className={`mx-auto p-3 rounded-xl bg-gradient-to-r ${getPlanColor(plan.name)} text-white w-fit`}>
                                        {getPlanIcon(plan.name)}
                                    </div>
                                    <CardTitle className="text-xl">{plan.displayName || plan.name}</CardTitle>
                                    <div className="text-3xl font-bold">
                                        {formatCurrencyFromCents(plan.price)}
                                        <span className="text-sm font-normal text-gray-600">
                                            {plan.price > 0 ? '/month' : ''}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-600">{plan.features.description}</p>
                                </CardHeader>

                                <CardContent className="space-y-4 flex-1 flex flex-col">
                                    <div className="space-y-3 flex-1">
                                        <div className="flex items-center gap-2">
                                            <Check className="h-4 w-4 text-green-500" />
                                            <span className="text-sm">{plan.features.maxActiveContests} active contests</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Check className="h-4 w-4 text-green-500" />
                                            <span className="text-sm">{plan.features.commissionPercentage}% commission</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Check className="h-4 w-4 text-green-500" />
                                            <span className="text-sm">Up to {plan.features.maxWinnersPerContest} winners</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Check className="h-4 w-4 text-green-500" />
                                            <span className="text-sm">{plan.features.analytics} analytics</span>
                                        </div>
                                    </div>

                                    <Separator />

                                    <div className="pt-2 mt-auto">
                                        {isCurrentPlan ? (
                                            <Button className="w-full" disabled>
                                                Current Plan
                                            </Button>
                                        ) : shouldShowSubscribe(plan) ? (
                                            <Button
                                                className="w-full"
                                                onClick={() => handleSubscribe(plan.id)}
                                                loading={isProcessing && processingPlanId === plan.id}
                                                loadingText="Processing..."
                                                variant={plan.price === 0 ? "outline" : "default"}
                                            >
                                                {plan.price === 0 ? (
                                                    <Gift className="h-4 w-4 mr-2" />
                                                ) : (
                                                    <CreditCard className="h-4 w-4 mr-2" />
                                                )}
                                                {plan.price === 0 ? 'Start Free' : 'Subscribe'}
                                            </Button>
                                        ) : canUpgradeToThis ? (
                                            <Button
                                                className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
                                                onClick={() => handleUpgradeClick(plan)}
                                                loading={isProcessing && processingPlanId === plan.id}
                                                loadingText="Processing..."
                                            >
                                                <TrendingUp className="h-4 w-4 mr-2" />
                                                Upgrade
                                            </Button>
                                        ) : canDowngradeToThis ? (
                                            <Button
                                                variant="outline"
                                                className="w-full"
                                                onClick={() => handleUpgradeClick(plan)}
                                                loading={isProcessing && processingPlanId === plan.id}
                                                loadingText="Processing..."
                                            >
                                                Downgrade
                                            </Button>
                                        ) : null}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>

            {/* Upgrade Modal */}
            {upgradeModalOpen && currentPlan && selectedTargetPlan && (
                <SubscriptionUpgradeModal
                    isOpen={upgradeModalOpen}
                    onClose={() => {
                        setUpgradeModalOpen(false);
                        setSelectedTargetPlan(null);
                    }}
                    currentPlan={currentPlan}
                    targetPlan={selectedTargetPlan}
                    onUpgradeSuccess={() => {
                        fetchCurrentSubscription();
                        setUpgradeModalOpen(false);
                        setSelectedTargetPlan(null);
                    }}
                    onUpgradeError={(error) => {
                        console.error('Upgrade error:', error);
                    }}
                />
            )}
        </div>
    );
}); 