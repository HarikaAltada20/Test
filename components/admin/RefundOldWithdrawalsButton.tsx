"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface RefundResult {
    message: string;
    total: number;
    processed: number;
    errors: number;
    errorDetails?: string[];
}

export function RefundOldWithdrawalsButton() {
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<RefundResult | null>(null);

    const handleRefund = async () => {
        if (!confirm('Are you sure you want to refund all old rejected withdrawals? This action cannot be undone.')) {
            return;
        }

        setIsLoading(true);
        setResult(null);

        try {
            const response = await fetch('/api/admin/refund-old-withdrawals', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to process refunds');
            }

            setResult(data);

            if (data.errors > 0) {
                toast.warning(`Processed ${data.processed} refunds with ${data.errors} errors`);
            } else {
                toast.success(`Successfully processed ${data.processed} refunds`);
            }

        } catch (error: any) {
            console.error('Error processing refunds:', error);
            toast.error(error.message || 'Failed to process refunds');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card className="w-full max-w-2xl">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <RefreshCw className="h-5 w-5 text-orange-600" />
                    Refund Old Rejected Withdrawals
                </CardTitle>
                <CardDescription>
                    This will refund all old rejected withdrawals that were not automatically refunded.
                    This is a one-time fix for historical data.
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
                <Alert className="bg-orange-50 border-orange-200">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                    <AlertDescription className="text-sm text-orange-800">
                        <strong>Warning:</strong> This action will refund all rejected withdrawals that haven't been refunded yet.
                        Make sure you want to proceed before clicking the button.
                    </AlertDescription>
                </Alert>

                <Button
                    onClick={handleRefund}
                    disabled={isLoading}
                    className="w-full bg-orange-600 hover:bg-orange-700"
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing Refunds...
                        </>
                    ) : (
                        <>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Refund Old Rejected Withdrawals
                        </>
                    )}
                </Button>

                {result && (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                            {result.errors === 0 ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : (
                                <AlertCircle className="h-4 w-4 text-orange-600" />
                            )}
                            <span className="font-medium">
                                {result.message}
                            </span>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm">
                            <div className="text-center p-2 bg-gray-50 rounded">
                                <div className="font-semibold text-gray-900">{result.total}</div>
                                <div className="text-gray-600">Total Found</div>
                            </div>
                            <div className="text-center p-2 bg-green-50 rounded">
                                <div className="font-semibold text-green-900">{result.processed}</div>
                                <div className="text-green-600">Successfully Processed</div>
                            </div>
                            <div className="text-center p-2 bg-red-50 rounded">
                                <div className="font-semibold text-red-900">{result.errors}</div>
                                <div className="text-red-600">Errors</div>
                            </div>
                        </div>

                        {result.errorDetails && result.errorDetails.length > 0 && (
                            <div className="mt-4">
                                <h4 className="font-medium text-sm text-gray-900 mb-2">Error Details:</h4>
                                <div className="max-h-32 overflow-y-auto space-y-1">
                                    {result.errorDetails.map((error, index) => (
                                        <div key={index} className="text-xs text-red-600 bg-red-50 p-2 rounded">
                                            {error}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
