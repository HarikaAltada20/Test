import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAccount,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import {
  getStablecoinDecimals,
  getTokenMintAddress,
  isValidWalletAddress,
} from "@/lib/solana-utils";

export type BuildTokenTransferParams = {
  payerPublicKey: PublicKey;
  recipientWalletAddress: string;
  amountCents: number;
  tokenType: "USDC" | "USDT";
  /** Shown in wallet memo field when the extension supports it. */
  memo?: string;
};

const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
);

function createMemoInstruction(
  memo: string,
  signer: PublicKey,
): TransactionInstruction {
  return new TransactionInstruction({
    keys: [{ pubkey: signer, isSigner: true, isWritable: false }],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(memo, "utf8"),
  });
}

export async function buildTokenTransferTransaction(
  connection: Connection,
  params: BuildTokenTransferParams,
): Promise<Transaction> {
  const { payerPublicKey, recipientWalletAddress, amountCents, tokenType, memo } =
    params;

  if (
    !recipientWalletAddress ||
    !isValidWalletAddress(recipientWalletAddress)
  ) {
    throw new Error("Platform wallet is not configured");
  }

  if (amountCents <= 0) {
    throw new Error("Amount must be positive");
  }

  const mintAddress = getTokenMintAddress(tokenType);
  const mintPublicKey = new PublicKey(mintAddress);
  const recipientPublicKey = new PublicKey(recipientWalletAddress);
  const tokenDecimals = getStablecoinDecimals(tokenType);
  const tokenAmount = BigInt(Math.round(amountCents * 10_000));

  const senderTokenAccount = await getAssociatedTokenAddress(
    mintPublicKey,
    payerPublicKey,
  );
  const recipientTokenAccount = await getAssociatedTokenAddress(
    mintPublicKey,
    recipientPublicKey,
  );

  try {
    await getAccount(connection, senderTokenAccount);
  } catch {
    throw new Error(
      `Your wallet does not have a ${tokenType} balance account yet. Add ${tokenType} to your wallet, then try again.`,
    );
  }

  const transaction = new Transaction();

  const memoText =
    memo?.trim() ||
    `Game of Creators top-up: $${(amountCents / 100).toFixed(2)} ${tokenType}`;
  transaction.add(createMemoInstruction(memoText, payerPublicKey));

  try {
    await getAccount(connection, recipientTokenAccount);
  } catch {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        payerPublicKey,
        recipientTokenAccount,
        recipientPublicKey,
        mintPublicKey,
      ),
    );
  }

  transaction.add(
    createTransferCheckedInstruction(
      senderTokenAccount,
      mintPublicKey,
      recipientTokenAccount,
      payerPublicKey,
      tokenAmount,
      tokenDecimals,
    ),
  );

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = payerPublicKey;

  return transaction;
}
