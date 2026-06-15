"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Copy, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { SOLANA_NETWORK } from "@/lib/solana-utils";
import { buildTokenTransferTransaction } from "@/lib/solana-build-transfer";
import { useConnectWallet } from "@/components/solana/useConnectWallet";
import type { WalletName } from "@solana/wallet-adapter-base";

export type WalletPayPaymentRequest = {
  amount: number;
  amountCents: number;
  tokenType: "USDC" | "USDT";
  walletAddress: string;
  memo?: string;
  referenceId?: string;
};

interface WalletPaySectionProps {
  paymentRequest: WalletPayPaymentRequest;
  isDark?: boolean;
  onPaymentSent: (signature: string) => Promise<void>;
  disabled?: boolean;
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function networkLabel(): string {
  return SOLANA_NETWORK === "devnet" ? "Solana devnet" : "Solana mainnet";
}

function PaymentSummary({
  paymentRequest,
  isDark,
  onCopyAddress,
  copied,
}: {
  paymentRequest: WalletPayPaymentRequest;
  isDark?: boolean;
  onCopyAddress: () => void;
  copied: boolean;
}) {
  const formattedAmount = paymentRequest.amount.toFixed(2);

  return (
    <div
      className={cn(
        "rounded-lg border p-3 space-y-3 text-sm",
        isDark
          ? "border-[#2F2754] bg-[#0F0A27]/80"
          : "border-gray-200 bg-white",
      )}
    >
      <p
        className={cn(
          "text-xs font-semibold uppercase tracking-wide",
          isDark ? "text-gray-400" : "text-gray-500",
        )}
      >
        Payment details
      </p>

      <div className="grid gap-2">
        <div className="flex justify-between gap-3">
          <span className={isDark ? "text-gray-400" : "text-gray-600"}>
            You send
          </span>
          <span
            className={cn(
              "font-semibold tabular-nums text-right",
              isDark ? "text-white" : "text-gray-900",
            )}
          >
            ${formattedAmount} {paymentRequest.tokenType}
          </span>
        </div>

        <div className="flex justify-between gap-3">
          <span className={isDark ? "text-gray-400" : "text-gray-600"}>
            Token
          </span>
          <span className={isDark ? "text-gray-200" : "text-gray-900"}>
            {paymentRequest.tokenType} (Solana SPL)
          </span>
        </div>

        <div className="flex justify-between gap-3">
          <span className={isDark ? "text-gray-400" : "text-gray-600"}>
            Network
          </span>
          <span className={isDark ? "text-gray-200" : "text-gray-900"}>
            {networkLabel()}
          </span>
        </div>

        <div className="space-y-1.5">
          <span className={isDark ? "text-gray-400" : "text-gray-600"}>
            Recipient wallet
          </span>
          <div className="flex items-start gap-2">
            <code
              className={cn(
                "flex-1 break-all rounded-md border px-2 py-1.5 text-xs font-mono leading-relaxed",
                isDark
                  ? "border-[#2F2754] bg-[#06021D] text-gray-100"
                  : "border-gray-200 bg-gray-50 text-gray-900",
              )}
            >
              {paymentRequest.walletAddress}
            </code>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={onCopyAddress}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-600" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      <p
        className={cn(
          "text-xs leading-relaxed",
          isDark ? "text-gray-500" : "text-gray-500",
        )}
      >
        Some wallets (e.g. Trust Wallet) show a generic &quot;Sign transaction&quot;
        screen. Confirm only if the amount and recipient above match what you
        intend to send.
      </p>
    </div>
  );
}

export function WalletPaySection({
  paymentRequest,
  isDark = false,
  onPaymentSent,
  disabled = false,
}: WalletPaySectionProps) {
  const { connection } = useConnection();
  const { sendTransaction } = useWallet();
  const {
    installedWallets,
    connectWallet,
    connected,
    connecting,
    wallet,
    publicKey,
    disconnect,
  } = useConnectWallet();
  const [isPaying, setIsPaying] = useState(false);
  const [connectingName, setConnectingName] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);

  const formattedAmount = paymentRequest.amount.toFixed(2);
  const isBusy = connecting || isPaying;

  const handleWalletConnect = async (walletName: WalletName) => {
    if (isBusy) return;

    setConnectingName(walletName);
    try {
      await connectWallet(walletName);
    } catch (error) {
      console.error("Wallet connect error:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not connect wallet. Try again or use manual pay below.",
      );
    } finally {
      setConnectingName(null);
    }
  };

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(paymentRequest.walletAddress);
      setCopiedAddress(true);
      toast.success("Recipient address copied");
      window.setTimeout(() => setCopiedAddress(false), 2000);
    } catch {
      toast.error("Failed to copy address");
    }
  };

  const executeWalletPay = async () => {
    if (!publicKey) {
      toast.error("Connect your wallet first");
      return;
    }

    setIsPaying(true);
    try {
      const transaction = await buildTokenTransferTransaction(connection, {
        payerPublicKey: publicKey,
        recipientWalletAddress: paymentRequest.walletAddress,
        amountCents: paymentRequest.amountCents,
        tokenType: paymentRequest.tokenType,
        memo: paymentRequest.memo,
      });

      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature, "confirmed");
      await onPaymentSent(signature);
    } catch (error) {
      console.error("Wallet pay error:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Payment failed. Try again or use manual pay below.",
      );
    } finally {
      setIsPaying(false);
      setConfirmOpen(false);
    }
  };

  return (
    <>
      <div
        className={cn(
          "rounded-xl border p-4 space-y-4",
          isDark
            ? "border-[#7F39EC]/40 bg-[#120A30]/80"
            : "border-[#7F39EC]/25 bg-purple-50/50",
        )}
      >
        <div>
          <p
            className={cn(
              "text-sm font-semibold",
              isDark ? "text-white" : "text-gray-900",
            )}
          >
            Pay with your wallet
          </p>
          <p
            className={cn(
              "text-xs mt-1 leading-relaxed",
              isDark ? "text-gray-400" : "text-gray-600",
            )}
          >
            Connect your wallet, review the payment details below, then approve
            in your extension. Phantom usually shows amount and token; Trust
            Wallet may show a generic sign screen — use the summary here to
            verify.
          </p>
        </div>

        {connected && publicKey ? (
          <>
            <div
              className={cn(
                "rounded-lg border px-3 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2",
                isDark
                  ? "border-green-500/30 bg-green-500/10"
                  : "border-green-200 bg-green-50",
              )}
            >
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-xs font-medium",
                    isDark ? "text-green-300" : "text-green-700",
                  )}
                >
                  Connected · {wallet?.adapter.name ?? "Wallet"}
                </p>
                <p
                  className={cn(
                    "text-xs font-mono truncate",
                    isDark ? "text-gray-300" : "text-gray-600",
                  )}
                >
                  {truncateAddress(publicKey.toBase58())}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isBusy}
                onClick={() => void disconnect()}
                className={cn(
                  "shrink-0",
                  isDark
                    ? "border-gray-600 text-gray-200 hover:bg-white/5"
                    : "border-gray-300",
                )}
              >
                Disconnect
              </Button>
            </div>

            <PaymentSummary
              paymentRequest={paymentRequest}
              isDark={isDark}
              onCopyAddress={() => void handleCopyAddress()}
              copied={copiedAddress}
            />
          </>
        ) : installedWallets.length > 0 ? (
          <div className="grid grid-cols-1 gap-2">
            {installedWallets.map(({ adapter }) => {
              const isConnectingThis =
                connectingName === adapter.name ||
                (connecting && wallet?.adapter.name === adapter.name);

              return (
                <Button
                  key={adapter.name}
                  type="button"
                  variant="outline"
                  disabled={disabled || isBusy}
                  onClick={() =>
                    void handleWalletConnect(adapter.name as WalletName)
                  }
                  className={cn(
                    "h-11 justify-start gap-3 font-medium",
                    isDark
                      ? "border-[#2F2754] bg-[#0F0A27] text-white hover:bg-[#1A1035]"
                      : "border-gray-200 bg-white text-gray-900 hover:bg-gray-50",
                  )}
                >
                  {adapter.icon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={adapter.icon}
                      alt=""
                      className="h-6 w-6 rounded-md"
                    />
                  ) : null}
                  <span className="flex-1 text-left">
                    {isConnectingThis
                      ? `Connecting to ${adapter.name}…`
                      : `Connect ${adapter.name}`}
                  </span>
                  {isConnectingThis ? (
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  ) : null}
                </Button>
              );
            })}
          </div>
        ) : (
          <div
            className={cn(
              "rounded-lg border px-3 py-3 text-xs leading-relaxed",
              isDark
                ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
                : "border-amber-200 bg-amber-50 text-amber-900",
            )}
          >
            No Solana browser wallet detected. Install{" "}
            <a
              href="https://phantom.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-medium"
            >
              Phantom
            </a>{" "}
            or another Solana wallet extension, refresh this page, then try
            again. You can still pay manually below.
          </div>
        )}

        <Button
          onClick={() => setConfirmOpen(true)}
          disabled={disabled || !connected || isBusy}
          className="w-full bg-[#7F39EC] hover:bg-[#6929D1] text-white font-semibold"
        >
          {isPaying ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing payment…
            </>
          ) : (
            <>Review & pay ${formattedAmount} {paymentRequest.tokenType}</>
          )}
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className={isDark ? "bg-[#06021D] border-[#2F2754]" : ""}>
          <AlertDialogHeader>
            <AlertDialogTitle className={isDark ? "text-white" : ""}>
              Confirm wallet payment
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-left">
                <p className={isDark ? "text-gray-300" : "text-gray-600"}>
                  Your wallet will open next. Approve only if these details are
                  correct:
                </p>
                <PaymentSummary
                  paymentRequest={paymentRequest}
                  isDark={isDark}
                  onCopyAddress={() => void handleCopyAddress()}
                  copied={copiedAddress}
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPaying}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPaying}
              className="bg-[#7F39EC] hover:bg-[#6929D1] text-white"
              onClick={(event) => {
                event.preventDefault();
                void executeWalletPay();
              }}
            >
              {isPaying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Opening wallet…
                </>
              ) : (
                <>Open wallet to pay</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
