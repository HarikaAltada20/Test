Here is a **clean, production-ready Markdown document** you can safely store in your repository (for example `docs/solana-wallet-derivation.md`).
It keeps the explanation simple so **new developers joining your team will understand the issue quickly**.

---

```md
# Solana Wallet Restoration & Address Derivation Guide

## Overview

When restoring a wallet using the **same seed phrase** in different decentralized wallet applications, the **Solana public address may change**, and previously held funds may not appear in the restored wallet.

This behavior can be confusing and may lead developers to believe that funds are missing, while in reality the wallet is simply deriving a **different address** from the same seed phrase.

This document explains why this happens and how to avoid issues when working with Solana wallets.

---

# Problem Example

Wallet created using **Phantom Wallet** shows the following address:

```

B7Wqrh4pXPUzhCCpk8aPGESBUsDrSPLKGUBoPRWdqCFh

```

The wallet contains:

```

0.1 USDC

```

If the **same seed phrase** is restored in **Trust Wallet**, the Solana address may appear as:

```

49jpchR1JNMJvsexrt6bdBb93shkHPzHz2uRveKTB34m

```

This new address shows **no funds**, even though the seed phrase is correct.

---

# Root Cause

The issue occurs because different wallets use **different derivation paths** to generate Solana accounts from the same seed phrase.

Example derivation paths:

Phantom Wallet may use:

```

m/44'/501'/0'/0'

```

Trust Wallet may use:

```

m/44'/501'/0'

```

Since the derivation path differs, the resulting **Solana address is different**, even though both are derived from the same seed phrase.

---

# Important Concept

A **seed phrase does NOT correspond to a single wallet address**.

Instead, it generates a **hierarchical tree of accounts**.

Example:

```

Seed Phrase
│
├── Account 1 → Address A
├── Account 2 → Address B
├── Account 3 → Address C

```

Different wallet applications may open **different accounts by default**.

---

# Why This Happens Mainly on Solana

For many networks such as Ethereum or Polygon, wallets typically follow the **same derivation standard**, which results in identical addresses across wallet applications.

However, historically on Solana, wallets implemented **different derivation paths**, which causes the address mismatch.

---

# Recommended Solution

To ensure the **exact same Solana address** is restored across wallets, import the **private key of the specific Solana account**, rather than relying solely on the seed phrase.

Importing the private key guarantees that the same wallet address will be used regardless of the wallet application.

---

# Security Best Practices

Private keys are extremely sensitive and must **never be stored insecurely**.

Follow these rules:

- Never commit private keys to Git repositories
- Never store private keys in plaintext files
- Use secure secret storage solutions
- Prefer hardware wallets for production funds
- Restrict access to private keys within the team

---

# How to Verify Wallet Funds

If there is any confusion about balances, always verify directly on the blockchain using a Solana explorer.

Example workflow:

1. Open a Solana blockchain explorer (e.g., Solscan)
2. Search the wallet address
3. Confirm token balances and transactions

Blockchain explorers show the **true on-chain state**, independent of wallet applications.

---

# Key Takeaway

Restoring a wallet from a seed phrase in different applications may generate **different Solana addresses** due to derivation path differences.

If the correct address is required, import the **exact private key for that account**.

Funds are always stored on the blockchain and remain safe as long as the correct account is accessed.
```

---

✅ This version is:

* **clear for future developers**
* **accurate technically**
* **safe from a security perspective**
* **formatted properly for GitHub / Notion / docs**

---

If you want, I can also give you a **much more powerful second doc** you should honestly have in your repo:

**`crypto-payment-architecture.md`**

It will explain:

* how to accept crypto payments safely
* how exchanges track deposits
* why **one-wallet-for-all-payments is dangerous**
* the **correct architecture for your GoViral platform**

That doc will save you **massive headaches later**.
