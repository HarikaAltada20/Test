import Stripe from 'stripe';
import { loadStripe } from '@stripe/stripe-js';

// Server-side Stripe instance - use lazy initialization
let stripeInstance: Stripe | null = null;

export const stripe = (): Stripe => {
  if (!stripeInstance) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const apiVersion = process.env.STRIPE_API_VERSION || '2025-07-30.basil'; // Updated to latest working version
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not set in environment variables');
    }

    const maskKey = (key?: string) => (key ? `${key.slice(0, 7)}...${key.slice(-4)}` : 'undefined');
    const keyMode = secretKey.startsWith('sk_live_') ? 'live' : (secretKey.startsWith('sk_test_') ? 'test' : 'unknown');
    // Server-side Stripe initialization logging
    console.log('[Stripe] Initializing server SDK', {
      mode: keyMode,
      apiVersion,
      secretKeyMasked: maskKey(secretKey),
    });

    stripeInstance = new Stripe(secretKey, {
      // Cast to satisfy Stripe's literal apiVersion type in @types for this SDK version
      apiVersion: apiVersion as any,
      typescript: true,
    });
  }
  return stripeInstance;
};

// Client-side Stripe instance
let stripePromise: Promise<import('@stripe/stripe-js').Stripe | null>;

export const getStripe = () => {
  if (!stripePromise) {
    const publishableKey =
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
      process.env.STRIPE_PUBLISHABLE_KEY; // fallback to non-next public var if set

    if (!publishableKey) {
      console.error('[Stripe] Missing publishable key. Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (preferred) or STRIPE_PUBLISHABLE_KEY.');
    } else {
      const maskKey = (key?: string) => (key ? `${key.slice(0, 7)}...${key.slice(-4)}` : 'undefined');
      const keyMode = publishableKey.startsWith('pk_live_') ? 'live' : (publishableKey.startsWith('pk_test_') ? 'test' : 'unknown');
      console.log('[Stripe] Initializing client SDK', {
        mode: keyMode,
        publishableKeyMasked: maskKey(publishableKey),
      });
    }

    stripePromise = loadStripe(publishableKey as string);
  }
  return stripePromise;
};

// Stripe configuration constants
export const STRIPE_CONFIG = {
  currency: 'usd',
  payment_method_types: ['card'],
  mode: 'payment' as const,
} as const;

// Helper function to format amount for Stripe (convert dollars to cents)
export const formatAmountForStripe = (amount: number): number => {
  return Math.round(amount * 100);
};

// Helper function to format amount from Stripe (convert cents to dollars)
export const formatAmountFromStripe = (amount: number): number => {
  return amount / 100;
}; 