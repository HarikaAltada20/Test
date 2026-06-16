"use client";

import { useMemo, type ReactNode } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import { getRpcEndpoint } from "@/lib/solana-utils";

/**
 * Official Solana Wallet Adapter setup.
 * Passes an empty wallet list so Wallet Standard auto-detects installed
 * browser wallets (Phantom, Trust, MetaMask Solana, Solflare, etc.).
 */
export function SolanaWalletProvider({ children }: { children: ReactNode }) {
  const endpoint = useMemo(() => getRpcEndpoint(), []);
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider
        wallets={wallets}
        autoConnect={false}
        onError={(error) => {
          console.error("Wallet error:", error);
          if (error.name === "WalletNotSelectedError") {
            return;
          }
          const message = error.message?.trim();
          if (!message) {
            return;
          }
          toast.error(message);
        }}
      >
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}
