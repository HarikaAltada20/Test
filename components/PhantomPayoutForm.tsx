"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Wallet, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { isValidPhantomWalletAddress } from '@/lib/solana-payout-utils';
import type { PhantomPayoutDetails } from '@/types/earnings';

interface PhantomPayoutFormProps {
    onSave: (details: PhantomPayoutDetails) => Promise<void>;
    onCancel: () => void;
    isLoading?: boolean;
}

export function PhantomPayoutForm({ onSave, onCancel, isLoading = false }: PhantomPayoutFormProps) {
    const [walletAddress, setWalletAddress] = useState('');
    const [preferredToken, setPreferredToken] = useState<'USDC' | 'USDT'>('USDC');
    const [friendlyName, setFriendlyName] = useState('');
    const [isValidating, setIsValidating] = useState(false);
    const [validationStatus, setValidationStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
    const [validationError, setValidationError] = useState('');

    const validateWallet = async () => {
        if (!walletAddress.trim()) {
            setValidationStatus('idle');
            return;
        }

        setIsValidating(true);
        setValidationStatus('validating');

        try {
            // Basic validation
            if (!isValidPhantomWalletAddress(walletAddress)) {
                setValidationStatus('invalid');
                setValidationError('Invalid Solana wallet address format. Please use a Phantom wallet address on Solana network.');
                return;
            }

            setValidationStatus('valid');
            setValidationError('');
            toast.success('Wallet address validated successfully!');
        } catch (error: any) {
            setValidationStatus('invalid');
            setValidationError(error.message || 'Failed to validate wallet address');
            toast.error('Wallet validation failed');
        } finally {
            setIsValidating(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (validationStatus !== 'valid') {
            toast.error('Please validate your wallet address first');
            return;
        }

        if (!walletAddress.trim()) {
            toast.error('Wallet address is required');
            return;
        }

        try {
            const details: PhantomPayoutDetails = {
                wallet_address: walletAddress.trim(),
                preferred_token: preferredToken,
                network: (process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'mainnet-beta' || process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'mainnet') ? 'mainnet' : 'devnet',
                friendly_name: friendlyName.trim() || 'Phantom Wallet'
            };

            await onSave(details);
            toast.success('Phantom Wallet payout method added successfully!');
        } catch (error: any) {
            toast.error(error.message || 'Failed to save payout method');
        }
    };

    return (
        <div className="w-full space-y-6">
            <div>
                <div className="flex items-center gap-2 mb-2">
                    <Wallet className="h-5 w-5 text-purple-600 flex-shrink-0" />
                    <h3 className="text-lg sm:text-xl font-semibold">Add Phantom Wallet</h3>
                </div>
                <p className="text-sm sm:text-base text-muted-foreground">
                    Add your Phantom Wallet to receive USDC or USDT payouts via Solana network directly to your wallet.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                {/* Friendly Name */}
                <div>
                    <Label htmlFor="friendlyName">Friendly Name</Label>
                    <Input
                        id="friendlyName"
                        value={friendlyName}
                        onChange={(e) => setFriendlyName(e.target.value)}
                        placeholder="e.g., My Main Wallet"
                        className="mt-1"
                    />
                </div>

                {/* Preferred Token */}
                <div>
                    <Label className="text-base font-semibold mb-3 block">Preferred Token</Label>
                    <RadioGroup
                        value={preferredToken}
                        onValueChange={(value) => setPreferredToken(value as 'USDC' | 'USDT')}
                        className="flex flex-col sm:flex-row gap-4 sm:gap-6 sm:space-x-6"
                    >
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="USDC" id="usdc" />
                            <Label htmlFor="usdc" className="cursor-pointer">
                                <div className="flex items-center gap-2">
                                    <span>USDC</span>
                                    <span className="text-xs text-gray-500">(USD Coin on Solana)</span>
                                </div>
                            </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="USDT" id="usdt" />
                            <Label htmlFor="usdt" className="cursor-pointer">
                                <div className="flex items-center gap-2">
                                    <span>USDT</span>
                                    <span className="text-xs text-gray-500">(Tether USD on Solana)</span>
                                </div>
                            </Label>
                        </div>
                    </RadioGroup>
                </div>

                {/* Wallet Address */}
                <div>
                    <Label htmlFor="walletAddress" className="flex items-center gap-2 flex-wrap">
                        <span>Solana Wallet Address *</span>
                        {validationStatus === 'valid' && <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />}
                        {validationStatus === 'invalid' && <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />}
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1 mb-2 break-words">
                        Enter your Phantom wallet address (Solana network only)
                    </p>
                    <div className="mt-1 flex flex-col sm:flex-row gap-2">
                        <Input
                            id="walletAddress"
                            value={walletAddress}
                            onChange={(e) => setWalletAddress(e.target.value)}
                            placeholder="Enter your Solana network wallet address"
                            className="flex-1 min-w-0"
                            disabled={isLoading}
                        />
                        <Button
                            type="button"
                            variant="outline"
                            onClick={validateWallet}
                            disabled={!walletAddress.trim() || isValidating || isLoading}
                            className="px-4 whitespace-nowrap"
                        >
                            {isValidating ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    <span className="hidden sm:inline">Validating</span>
                                </>
                            ) : (
                                'Validate'
                            )}
                        </Button>
                    </div>

                    {validationStatus === 'validating' && (
                        <p className="text-sm text-blue-600 mt-1">Validating wallet address...</p>
                    )}

                    {validationStatus === 'invalid' && (
                        <p className="text-sm text-red-600 mt-1">{validationError}</p>
                    )}

                    {validationStatus === 'valid' && (
                        <p className="text-sm text-green-600 mt-1">Solana wallet address is valid!</p>
                    )}
                </div>

                {/* Info Alert */}
                <Alert className="bg-blue-50 border-blue-200">
                    <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <AlertDescription className="text-sm text-blue-800 break-words">
                        <strong>Important:</strong>
                        <ul className="mt-2 space-y-1.5 ml-4 list-disc break-words">
                            <li className="break-words">Use your <strong>Solana network</strong> wallet address only (not Ethereum, Polygon, or other networks)</li>
                            <li className="break-words">Payouts are sent via <strong>Solana blockchain</strong> using USDC or USDT on Solana</li>
                            <li className="break-words">Make sure this is your correct Phantom wallet address - payouts cannot be reversed</li>
                        </ul>
                        <a
                            href="https://help.phantom.com/hc/en-us"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 underline mt-2 break-words"
                        >
                            <span className="break-words">Learn more about Phantom Wallet</span>
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        </a>
                    </AlertDescription>
                </Alert>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                    <Button
                        type="submit"
                        disabled={isLoading || validationStatus !== 'valid'}
                        className="flex-1 bg-purple-600 hover:bg-purple-700 w-full sm:w-auto"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                <span>Adding...</span>
                            </>
                        ) : (
                            'Add Phantom Wallet'
                        )}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onCancel}
                        disabled={isLoading}
                        className="flex-1 w-full sm:w-auto"
                    >
                        Cancel
                    </Button>
                </div>
            </form>
        </div>
    );
}
