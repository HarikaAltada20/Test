"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrencyFromCents } from '@/lib/currency-utils';

interface SolanaTransaction {
    id: string;
    transaction_signature: string;
    amount_received: number;
    token_type: 'USDC' | 'USDT';
    status: string;
    verification_status: string;
    balance_updated: boolean;
    created_at: string;
    block_time?: string;
    metadata?: any;
}

interface SolanaTransactionHistoryProps {
    refreshTrigger?: number;
}

export function SolanaTransactionHistory({ refreshTrigger }: SolanaTransactionHistoryProps) {
    const [transactions, setTransactions] = useState<SolanaTransaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const fetchTransactions = async (isRefresh = false) => {
        if (isRefresh) {
            setIsRefreshing(true);
        } else {
            setIsLoading(true);
        }

        try {
            const response = await fetch('/api/solana/transactions');
            if (response.ok) {
                const data = await response.json();
                setTransactions(data.transactions || []);
            }
        } catch (error) {
            console.error('Error fetching Solana transactions:', error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        fetchTransactions();
    }, [refreshTrigger]);

    const getStatusBadge = (tx: SolanaTransaction) => {
        if (tx.balance_updated) {
            return <Badge className="bg-green-500">Completed</Badge>;
        }
        if (tx.verification_status === 'verified') {
            return <Badge className="bg-blue-500">Processing</Badge>;
        }
        if (tx.verification_status === 'invalid') {
            return <Badge variant="destructive">Failed</Badge>;
        }
        return <Badge variant="secondary">{tx.status}</Badge>;
    };

    const getSolscanUrl = (signature: string) => {
        const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'mainnet-beta';
        const cluster = (network === 'mainnet-beta' || network === 'mainnet') ? '' : '?cluster=devnet';
        return `https://solscan.io/tx/${signature}${cluster}`;
    };

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Solana Transactions</CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </CardContent>
            </Card>
        );
    }

    if (transactions.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Solana Transactions</CardTitle>
                </CardHeader>
                <CardContent className="text-center py-8 text-gray-500">
                    No Solana transactions yet
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Solana Transactions</CardTitle>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fetchTransactions(true)}
                    disabled={isRefreshing}
                >
                    {isRefreshing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <RefreshCw className="h-4 w-4" />
                    )}
                </Button>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {transactions.map((tx) => (
                        <div
                            key={tx.id}
                            className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-semibold text-green-600">
                                        +{formatCurrencyFromCents(tx.amount_received)}
                                    </span>
                                    <Badge variant="outline" className="text-xs">
                                        {tx.token_type}
                                    </Badge>
                                    {getStatusBadge(tx)}
                                </div>
                                <div className="text-xs text-gray-500 font-mono">
                                    {tx.transaction_signature.substring(0, 20)}...
                                    {tx.transaction_signature.substring(tx.transaction_signature.length - 10)}
                                </div>
                                <div className="text-xs text-gray-400 mt-1">
                                    {new Date(tx.created_at).toLocaleString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })}
                                </div>
                            </div>
                            <div>
                                <a
                                    href={getSolscanUrl(tx.transaction_signature)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[#7F39EC] hover:text-[#6929D1] flex items-center gap-1 text-sm"
                                >
                                    View <ExternalLink className="h-3 w-3" />
                                </a>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

