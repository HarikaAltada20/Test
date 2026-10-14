/** IDs must match CSV column keys in /api/admin/withdrawals/export */
export const WITHDRAWAL_EXPORT_COLUMN_IDS = [
  "payee_email",
  "payout_currency",
  "payout_amount",
  "description",
  "request_count",
  "usernames",
  "id",
  "created_at",
  "processed_at",
  "status",
  "amount",
  "amount_type",
  "currency",
  "full_name",
  "username",
  "email",
  "payout_method_type",
  "upi_id",
  "account_holder_name",
  "wallet_address",
  "bank_account_last4",
  "ifsc_or_swift",
  "bank_name",
  "skydo_email",
  "transaction_reference",
  "admin_notes",
  "user_notes",
  "payment_proof_link",
  "payment_proof_storage_path",
  "payout_details_json",
] as const;

export type WithdrawalExportColumnId =
  (typeof WITHDRAWAL_EXPORT_COLUMN_IDS)[number];

export const WITHDRAWAL_EXPORT_COLUMN_LABELS: Record<
  WithdrawalExportColumnId,
  string
> = {
  payee_email: "Payee (Skydo email / destination)",
  payout_currency: "Payout currency",
  payout_amount: "Payout amount (converted)",
  description: "Description",
  request_count: "Request count",
  usernames: "Usernames",
  id: "ID",
  created_at: "Created at",
  processed_at: "Processed at",
  status: "Status",
  amount: "Amount (cents)",
  amount_type: "Amount type",
  currency: "Currency",
  full_name: "Name",
  username: "Username",
  email: "Email",
  payout_method_type: "Payout method type",
  upi_id: "UPI ID",
  account_holder_name: "Account holder",
  wallet_address: "Wallet address",
  bank_account_last4: "Bank account last 4",
  ifsc_or_swift: "IFSC / SWIFT",
  bank_name: "Bank name",
  skydo_email: "Skydo email",
  transaction_reference: "Transaction reference",
  admin_notes: "Admin notes",
  user_notes: "User notes",
  payment_proof_link: "Payment proof link",
  payment_proof_storage_path: "Payment proof file path",
  payout_details_json: "Payout details (JSON)",
};

export type WithdrawalExportColumnSpec = {
  id: WithdrawalExportColumnId;
  header: string;
};

export const SKYDO_EXPORT_PRESET: WithdrawalExportColumnSpec[] = [
  { id: "payee_email", header: "Email" },
  { id: "payout_currency", header: "Currency" },
  { id: "payout_amount", header: "Amount" },
  { id: "description", header: "Description" },
];

export const EXPORT_CURRENCY_OPTIONS = [
  "USD",
  "INR",
  "EUR",
  "GBP",
  "AED",
  "CAD",
  "AUD",
  "SGD",
] as const;
