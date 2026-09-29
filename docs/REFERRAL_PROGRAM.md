# Referral Program

**Status:** Live (UI + capture) · **Updated:** May 25, 2026

---

## Overview

Game of Creators users can invite others with a personal **referral code** and **referral link**. Rewards differ by who you refer (creators vs brands) and by your own account type (creator vs advertiser/brand).

Referral codes are stored on `users.referral_code` (typically the same as `username`, set at username onboarding). Incoming signups store the inviter’s code in `users.referred_by`. Links use the `?ref=` query parameter; `ReferralCapture` persists the code in `localStorage` until signup completes.

---

## Creator dashboard — “Refer and earn upto $100”

Shown to **creator** accounts on the dashboard. Opens the referral earn modal with:

| Benefit | Detail |
|--------|--------|
| Rewards | If anyone joins through your referral, you get **100 coins** per signup. Additionally, you earn **10% of their winnings**, up to **$100** |

**Referral link (creators landing):**

```
https://<your-domain>/creators?ref=<referral_code>
```

**Referral code:** The user’s `referral_code` (or `username` if code is unset).

---

## Brand / advertiser dashboard — “Refer & earn 30%”

Shown to **advertiser (brand)** accounts on the dashboard. Opens the referral earn modal with:

| Benefit    | Detail                                                                          |
| ---------- | ------------------------------------------------------------------------------- |
| Audience   | Share the platform with more **brands**                                         |
| Commission | **30%** of subscription fees when your referrals pay, capped at **$2000** total |

**Referral link (brands landing):**

```
https://<your-domain>/brands?ref=<referral_code>
```

**Referral code:** Same as above (`referral_code` / `username`).

---

## General referral link

Settings also exposes a general link (any audience):

```
https://<your-domain>/?ref=<referral_code>
```

See **Settings → Share Referral Links** for copy buttons for general, creators, and brands URLs.

---

## Technical notes

| Piece                   | Location                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard CTA + modal   | `app/dashboard/page.tsx`, `components/ReferralEarnModal.tsx`                                                                    |
| URL capture on visit    | `components/ReferralCapture.tsx`                                                                                                |
| Settings referral modal | `app/dashboard/settings/client.tsx` (`buildReferralLinks`)                                                                      |
| DB fields               | `users.referral_code`, `users.referred_by`, `users.creators_referred`, `users.advertisers_referred`, `users.affiliate_earnings` |
| Coin ledger type        | `referral_bonus` (see `types/supabase.ts`)                                                                                      |

### Link builder (dashboard / settings)

```ts
const base = window.location.origin;
const code = referralCode || username;
// Creator-focused invite
`${base}/creators?ref=${code}`;
// Brand-focused invite
`${base}/brands?ref=${code}`;
```

### Survey CTA (disabled on dashboard)

The previous **“Fill survey and earn upto $5”** dashboard button is **commented out** in favor of the referral CTA. Survey flow remains available via `SurveyModal` and settings where applicable.

---

## Copy guidelines (product)

- **Creators referring creators:** 100 coins per signup; additionally, 10% of their winnings up to $100.
- **Brands referring brands:** Emphasize 30% recurring commission on subscription payments (max $2000).
- Always show **Referral code** and **Referral link** with one-click copy in the modal.

---

## Related docs

- [TRUST_SCORE_SYSTEM.md](./TRUST_SCORE_SYSTEM.md) — creator quality score (separate from referrals)
- Admin affiliate views: `app/dashboard/admin/affiliate/`, `app/api/admin/affiliate/`
