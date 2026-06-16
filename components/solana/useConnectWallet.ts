"use client";

import { useCallback, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  WalletReadyState,
  type WalletName,
} from "@solana/wallet-adapter-base";
import { useWallet } from "@solana/wallet-adapter-react";

const PREFERRED_WALLET_ORDER = [
  "Phantom",
  "Trust",
  "MetaMask",
  "Solflare",
  "Coinbase Wallet",
];

function walletSortIndex(name: string): number {
  const index = PREFERRED_WALLET_ORDER.indexOf(name);
  return index === -1 ? PREFERRED_WALLET_ORDER.length : index;
}

/** Let WalletProvider attach adapter event listeners after selection. */
function waitForAdapterListeners(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      window.setTimeout(resolve, 0);
    });
  });
}

export function useConnectWallet() {
  const {
    wallets,
    select,
    connected,
    connecting,
    disconnecting,
    wallet,
    publicKey,
    disconnect,
  } = useWallet();
  const [isConnecting, setIsConnecting] = useState(false);
  const walletRef = useRef(wallet);
  walletRef.current = wallet;

  const connectWallet = useCallback(
    async (walletName: WalletName) => {
      if (isConnecting || connecting || disconnecting) {
        return;
      }

      const walletItem = wallets.find((w) => w.adapter.name === walletName);
      if (!walletItem) {
        throw new Error(`${walletName} is not available in this browser.`);
      }

      if (
        walletItem.readyState !== WalletReadyState.Installed &&
        walletItem.readyState !== WalletReadyState.Loadable
      ) {
        throw new Error(`${walletName} is not installed.`);
      }

      if (
        connected &&
        wallet?.adapter.name === walletName &&
        walletItem.adapter.connected
      ) {
        return;
      }

      setIsConnecting(true);
      try {
        if (wallet && wallet.adapter.name !== walletName) {
          try {
            await disconnect();
          } catch {
            // Ignore errors while switching wallets.
          }
          await waitForAdapterListeners();
        }

        flushSync(() => {
          select(walletName);
        });

        if (walletRef.current?.adapter.name !== walletName) {
          throw new Error(`Could not select ${walletName}. Please try again.`);
        }

        await waitForAdapterListeners();
        await walletItem.adapter.connect();
      } finally {
        setIsConnecting(false);
      }
    },
    [
      wallets,
      select,
      connected,
      connecting,
      disconnecting,
      wallet,
      disconnect,
      isConnecting,
    ],
  );

  const installedWallets = wallets
    .filter((w) => w.readyState === WalletReadyState.Installed)
    .sort(
      (a, b) =>
        walletSortIndex(a.adapter.name) - walletSortIndex(b.adapter.name),
    );

  const isBusy = isConnecting || connecting || disconnecting;

  return {
    installedWallets,
    connectWallet,
    connected,
    connecting: isBusy,
    disconnecting,
    wallet,
    publicKey,
    disconnect,
  };
}
