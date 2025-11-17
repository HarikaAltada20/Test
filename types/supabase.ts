export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          profile_picture_url: string | null;
          user_type: "advertiser" | "creator";
          referral_code: string | null;
          referred_by: string | null;
          coins: number;
          advertisers_referred: number;
          creators_referred: number;
          username: string | null;
          is_active: boolean;
          email_confirmed_at: string | null;
          created_at: string;
          updated_at: string;
          affiliate_earnings: number;
          total_lifetime_coins_earned: number;
          registration_ip?: string | null;
          login_history?: Array<{
            ip_address: string;
            timestamp: string;
            user_agent?: string;
          }>;
        };
        Insert: {
          id?: string;
          email: string;
          full_name?: string | null;
          profile_picture_url?: string | null;
          user_type: "advertiser" | "creator";
          referral_code?: string | null;
          referred_by?: string | null;
          coins?: number;
          advertisers_referred?: number;
          creators_referred?: number;
          username?: string | null;
          is_active?: boolean;
          email_confirmed_at?: string | null;
          created_at?: string;
          updated_at?: string;
          affiliate_earnings?: number;
          total_lifetime_coins_earned?: number;
          registration_ip?: string | null;
          login_history?: Array<{
            ip_address: string;
            timestamp: string;
            user_agent?: string;
          }>;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          profile_picture_url?: string | null;
          user_type?: "advertiser" | "creator";
          referral_code?: string | null;
          referred_by?: string | null;
          coins?: number;
          advertisers_referred?: number;
          creators_referred?: number;
          username?: string | null;
          is_active?: boolean;
          email_confirmed_at?: string | null;
          created_at?: string;
          updated_at?: string;
          affiliate_earnings?: number;
          total_lifetime_coins_earned?: number;
          registration_ip?: string | null;
          login_history?: Array<{
            ip_address: string;
            timestamp: string;
            user_agent?: string;
          }>;
        };
      };
      customers: {
        Row: {
          id: string;
          stripe_customer_id: string;
          default_payment_method_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          stripe_customer_id: string;
          default_payment_method_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          stripe_customer_id?: string;
          default_payment_method_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      advertiser_profiles: {
        Row: {
          id: string;
          company_name: string | null;
          website_url: string | null;
          total_money_spent: number;
          total_contests_run: number;
          available_deposit_balance: number;
          withdrawable_balance: number;
        };
        Insert: {
          id: string;
          company_name?: string | null;
          website_url?: string | null;
          total_money_spent?: number;
          total_contests_run?: number;
          available_deposit_balance?: number;
          withdrawable_balance?: number;
        };
        Update: {
          id?: string;
          company_name?: string | null;
          website_url?: string | null;
          total_money_spent?: number;
          total_contests_run?: number;
          available_deposit_balance?: number;
          withdrawable_balance?: number;
        };
      };
      creator_profiles: {
        Row: {
          id: string;
          bio: string | null;
          youtube_account: Json | null;
          instagram_account: Json | null;
          total_contests_participated: number;
          total_contests_won: number;
          total_money_won: number;
          withdrawable_balance: number;
          total_views: number;
          type_of_content: Json | null;
          other_type_of_content: Json | null;
          has_claimed_profile_reward: boolean;
        };
        Insert: {
          id: string;
          bio?: string | null;
          youtube_account?: Json | null;
          instagram_account?: Json | null;
          total_contests_participated?: number;
          total_contests_won?: number;
          total_money_won?: number;
          withdrawable_balance?: number;
          total_views?: number;
          type_of_content?: Json | null;
          other_type_of_content?: Json | null;
          has_claimed_profile_reward?: boolean;
        };
        Update: {
          id?: string;
          bio?: string | null;
          youtube_account?: Json | null;
          instagram_account?: Json | null;
          total_contests_participated?: number;
          total_contests_won?: number;
          total_money_won?: number;
          withdrawable_balance?: number;
          total_views?: number;
          type_of_content?: Json | null;
          other_type_of_content?: Json | null;
          has_claimed_profile_reward?: boolean;
        };
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          plan_id: string;
          gateway: "stripe" | "razorpay";
          external_subscription_id: string | null;
          status: string;
          start_date: string;
          expiry_date: string;
          renews_on: string | null;
          cancel_at_period_end: boolean;
          trial_end: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan_id: string;
          gateway: "stripe" | "razorpay";
          external_subscription_id?: string | null;
          status: string;
          start_date: string;
          expiry_date: string;
          renews_on?: string | null;
          cancel_at_period_end?: boolean;
          trial_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          plan_id?: string;
          gateway?: "stripe" | "razorpay";
          external_subscription_id?: string | null;
          status?: string;
          start_date?: string;
          expiry_date?: string;
          renews_on?: string | null;
          cancel_at_period_end?: boolean;
          trial_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      contests: {
        Row: {
          id: string;
          advertiser_id: string;
          title: string;
          platform: string;
          start_date: string | null;
          end_date: string | null;
          thumbnail_url: string | null;
          brief_html: string | null;
          brief_json: Json | null;
          rules_html: string | null;
          rules_json: Json | null;
          resources:
            | {
                url: string;
                description: string;
                type: "internal" | "external";
              }[]
            | null;
          category: string | null;
          inspiration_links: { url: string; description: string }[] | null;
          tracking_links: { url: string; description: string }[] | null;
          created_at: string;
          updated_at: string;
          contest_type: "leaderboard" | "cpm";
          contest_based_details: Json | null;
          post_contest_status:
            | "pending_review"
            | "in_review"
            | "verification_complete"
            | "payouts_processed"
            | null;
          live_submission_count: number | null;
          last_metrics_updated: string | null;
          moderation_status:
            | "draft"
            | "pending_approval"
            | "approved"
            | "published"
            | "rejected";
          submitted_for_approval_at: string | null;
          approved_at: string | null;
          approved_by: string | null;
          published_at: string | null;
          rejection_reason: string | null;
          // New features (2025-10-01)
          multiple_submissions_enabled: boolean;
          max_submissions_per_creator: number;
          content_type: "ugc" | "clipping" | "other" | null;
          bonus_details: Json | null;
          max_earnings_per_creator: number | null; // Per-contest cap (in cents), NOT platform-wide
          // Note: flat_fee_bonus is stored in contest_based_details JSONB (in cents)
        };
        Insert: {
          id?: string;
          advertiser_id: string;
          title: string;
          platform: string;
          start_date?: string | null;
          end_date?: string | null;
          thumbnail_url?: string | null;
          brief_html?: string | null;
          brief_json?: Json | null;
          rules_html?: string | null;
          rules_json?: Json | null;
          resources?:
            | {
                url: string;
                description: string;
                type: "internal" | "external";
              }[]
            | null;
          category?: string | null;
          inspiration_links?: { url: string; description: string }[] | null;
          tracking_links?: { url: string; description: string }[] | null;
          created_at?: string;
          updated_at?: string;
          contest_type?: "leaderboard" | "cpm";
          contest_based_details?: Json | null;
          post_contest_status?:
            | "pending_review"
            | "in_review"
            | "verification_complete"
            | "payouts_processed"
            | null;
          live_submission_count?: number | null;
          last_metrics_updated?: string | null;
          moderation_status?:
            | "draft"
            | "pending_approval"
            | "approved"
            | "published"
            | "rejected";
          submitted_for_approval_at?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          published_at?: string | null;
          rejection_reason?: string | null;
          // New features
          multiple_submissions_enabled?: boolean;
          max_submissions_per_creator?: number;
          content_type?: "ugc" | "clipping" | "other" | null;
          bonus_details?: Json | null;
          max_earnings_per_creator?: number | null;
        };
        Update: {
          id?: string;
          advertiser_id?: string;
          title?: string;
          platform?: string;
          start_date?: string | null;
          end_date?: string | null;
          thumbnail_url?: string | null;
          brief_html?: string | null;
          brief_json?: Json | null;
          rules_html?: string | null;
          rules_json?: Json | null;
          resources?:
            | {
                url: string;
                description: string;
                type: "internal" | "external";
              }[]
            | null;
          category?: string | null;
          inspiration_links?: { url: string; description: string }[] | null;
          created_at?: string;
          updated_at?: string;
          contest_type?: "leaderboard" | "cpm";
          contest_based_details?: Json | null;
          post_contest_status?:
            | "pending_review"
            | "in_review"
            | "verification_complete"
            | "payouts_processed"
            | null;
          live_submission_count?: number | null;
          last_metrics_updated?: string | null;
          moderation_status?:
            | "draft"
            | "pending_approval"
            | "approved"
            | "published"
            | "rejected";
          submitted_for_approval_at?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          published_at?: string | null;
          rejection_reason?: string | null;
          // New features
          multiple_submissions_enabled?: boolean;
          max_submissions_per_creator?: number;
          content_type?: "ugc" | "clipping" | "other" | null;
          bonus_details?: Json | null;
          max_earnings_per_creator?: number | null;
        };
      };
      submissions: {
        Row: {
          id: string;
          contest_id: string;
          creator_id: string;
          content_link: string;
          views: number;
          metadata: Json | null;
          other_stats: Json | null;
          created_at: string;
          status: "pending" | "verified" | "rejected" | "paid";
          earnings: number | null;
          last_insights_update: string | null;
          platform: string | null;
          video_id: string | null;
          video_title: string | null;
          video_thumbnail_url: string | null;
          paid: boolean;
          paid_at: string | null;
          bonus_paid: boolean;
          bonus_paid_at: string | null;
          bonus_amount: number;
        };
        Insert: {
          id?: string;
          contest_id: string;
          creator_id: string;
          content_link: string;
          views?: number;
          metadata?: Json | null;
          other_stats?: Json | null;
          created_at?: string;
          status?: "pending" | "verified" | "rejected" | "paid";
          earnings?: number | null;
          last_insights_update?: string | null;
          platform?: string | null;
          video_id?: string | null;
          video_title?: string | null;
          video_thumbnail_url?: string | null;
          paid?: boolean;
          paid_at?: string | null;
          bonus_paid?: boolean;
          bonus_paid_at?: string | null;
          bonus_amount?: number;
        };
        Update: {
          id?: string;
          contest_id?: string;
          creator_id?: string;
          content_link?: string;
          views?: number;
          metadata?: Json | null;
          other_stats?: Json | null;
          created_at?: string;
          status?: "pending" | "verified" | "rejected" | "paid";
          earnings?: number | null;
          last_insights_update?: string | null;
          platform?: string | null;
          video_id?: string | null;
          video_title?: string | null;
          video_thumbnail_url?: string | null;
          paid?: boolean;
          paid_at?: string | null;
          bonus_paid?: boolean;
          bonus_paid_at?: string | null;
          bonus_amount?: number;
        };
      };
      money_transactions: {
        Row: {
          id: string;
          user_id: string;
          type:
            | "withdrawal"
            | "reward"
            | "deposit"
            | "contest_payment"
            | "refund"
            | "subscription_payment"
            | "subscription_refund";
          status: "pending" | "success" | "failed" | "cancelled";
          amount: number;
          description: string | null;
          created_at: string;
          updated_at: string;
          currency: string | null;
          withdrawal_request_id: string | null;
          remarks: string | null;
          payment_intent_id: string | null;
          payment_method: string | null;
          metadata: any | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          type:
            | "withdrawal"
            | "reward"
            | "deposit"
            | "contest_payment"
            | "refund"
            | "subscription_payment"
            | "subscription_refund";
          status?: "pending" | "success" | "failed" | "cancelled";
          amount: number;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
          currency?: string | null;
          withdrawal_request_id?: string | null;
          remarks?: string | null;
          payment_intent_id?: string | null;
          payment_method?: string | null;
          metadata?: any | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?:
            | "withdrawal"
            | "reward"
            | "deposit"
            | "contest_payment"
            | "refund"
            | "subscription_payment"
            | "subscription_refund";
          status?: "pending" | "success" | "failed" | "cancelled";
          amount?: number;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
          currency?: string | null;
          withdrawal_request_id?: string | null;
          remarks?: string | null;
          payment_intent_id?: string | null;
          payment_method?: string | null;
          metadata?: any | null;
        };
      };
      coin_transactions: {
        Row: {
          id: string;
          user_id: string;
          type: "referral_bonus" | "spent" | "earned" | "bonus";
          status: "pending" | "success" | "failed";
          coins: number;
          description: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: "referral_bonus" | "spent" | "earned" | "bonus";
          status?: "pending" | "success" | "failed";
          coins: number;
          description: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: "referral_bonus" | "spent" | "earned" | "bonus";
          status?: "pending" | "success" | "failed";
          coins?: number;
          description?: string;
          created_at?: string;
        };
      };
      withdrawal_requests: {
        Row: {
          id: string;
          user_id: string;
          payout_method_id: string | null;
          amount_cents: number;
          currency: string;
          status:
            | "pending"
            | "approved"
            | "rejected"
            | "processed"
            | "failed"
            | "cancelled";
          processed_at: string | null;
          transaction_reference: string | null;
          admin_notes: string | null;
          user_notes: string | null;
          created_at: string;
          updated_at: string;
          amount_type: "cash" | "coins";
          payout_method_type_snapshot: string | null;
          payout_method_details_snapshot: Json | null;
          cancelled_at: string | null;
          cancellation_reason: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          payout_method_id?: string | null;
          amount_cents: number;
          currency?: string;
          status?:
            | "pending"
            | "approved"
            | "rejected"
            | "processed"
            | "failed"
            | "cancelled";
          processed_at?: string | null;
          transaction_reference?: string | null;
          admin_notes?: string | null;
          user_notes?: string | null;
          created_at?: string;
          updated_at?: string;
          amount_type: "cash" | "coins";
          payout_method_type_snapshot?: string | null;
          payout_method_details_snapshot?: Json | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          payout_method_id?: string | null;
          amount_cents?: number;
          currency?: string;
          status?:
            | "pending"
            | "approved"
            | "rejected"
            | "processed"
            | "failed"
            | "cancelled";
          processed_at?: string | null;
          transaction_reference?: string | null;
          admin_notes?: string | null;
          user_notes?: string | null;
          created_at?: string;
          updated_at?: string;
          amount_type?: "cash" | "coins";
          payout_method_type_snapshot?: string | null;
          payout_method_details_snapshot?: Json | null;
          cancelled_at?: string | null;
          cancellation_reason?: string | null;
        };
      };
    };
    Views: {
      contests_with_status: {
        Row: {
          id: string | null;
          advertiser_id: string | null;
          title: string | null;
          platform: string | null;
          start_date: string | null;
          end_date: string | null;
          thumbnail_url: string | null;
          brief_html: string | null;
          brief_json: Json | null;
          rules_html: string | null;
          rules_json: Json | null;
          resources:
            | {
                url: string;
                description: string;
                type: "internal" | "external";
              }[]
            | null;
          category: string | null;
          inspiration_links: { url: string; description: string }[] | null;
          tracking_links: { url: string; description: string }[] | null;
          created_at: string | null;
          updated_at: string | null;
          contest_type: "leaderboard" | "cpm" | null;
          contest_based_details: Json | null;
          post_contest_status:
            | "pending_review"
            | "in_review"
            | "verification_complete"
            | "payouts_processed"
            | null;
          live_submission_count: number | null;
          last_metrics_updated: string | null;
          // Moderation status (admin approval workflow)
          moderation_status:
            | "draft"
            | "pending_approval"
            | "approved"
            | "published"
            | "rejected"
            | null;
          submitted_for_approval_at: string | null;
          approved_at: string | null;
          approved_by: string | null;
          published_at: string | null;
          rejection_reason: string | null;
          // Contest lifecycle status (only for published contests)
          status:
            | "draft"
            | "pending_approval"
            | "approved"
            | "rejected"
            | "incomplete"
            | "upcoming"
            | "active"
            | "ended"
            | "unknown"
            | null;
          // New features (2025-10-01)
          multiple_submissions_enabled: boolean | null;
          max_submissions_per_creator: number | null;
          content_type: "ugc" | "clipping" | "other" | null;
          bonus_details: Json | null;
          max_earnings_per_creator: number | null;
        };
      };
    };
    Functions: {
      // ... functions ...
    };
  };
}

// Helper type for submissions with contest details
export type SubmissionWithContest =
  Database["public"]["Tables"]["submissions"]["Row"] & {
    contests: Database["public"]["Views"]["contests_with_status"]["Row"] | null;
    formatted_created_at?: string;
  };

// CPM contest specific details structure (for contest_based_details JSONB)
export interface CpmContestDetails {
  cpm_rate_usd: number;
  min_views?: number;
  max_views?: number;
  total_budget: number;
  budget_spent?: number;
  terms_conditions: string;
  flat_fee_bonus?: number; // OPTIONAL - flat fee per verified submission (in cents)
}

// Leaderboard contest specific details structure (for contest_based_details JSONB)
export interface LeaderboardContestDetails {
  prizes: { position: number; amount: number }[];
  total_prize: number;
  winner_count: number;
  total_budget?: number | null; // OPTIONAL - budget for flat fee bonuses and future features (in cents)
  flat_fee_bonus?: number; // OPTIONAL - flat fee per verified submission (in cents)
}

// Bonus Payment tracking interface
export interface BonusPayment {
  submission_id: string;
  creator_id: string;
  contest_id: string;
  bonus_amount: number; // in cents
  paid: boolean;
  paid_at?: string;
  payment_proof_url?: string;
  payment_remarks?: string;
}

// Bonus details structure (for bonus_details JSONB)
export interface BonusDetails {
  description_html?: string; // Rich text HTML content
  description_json?: any; // Rich text JSON content for editing
  // Legacy support (deprecated, use description_html instead)
  description?: string;
}

// Submission metadata types
export interface SubmissionRejectionMetadata {
  type: "rejection";
  reason: string;
  additionalNotes?: string | null;
  timestamp: string;
  updatedBy: string;
  legacy?: boolean;
}

export interface SubmissionPaymentMetadata {
  type: "payment";
  paymentProofUrl: string | null;
  paymentDescription: string | null;
  timestamp: string;
  updatedBy: string;
}

export type SubmissionMetadata =
  | SubmissionRejectionMetadata
  | SubmissionPaymentMetadata;

// Ensure the submission status type reflects the ENUM from your database
// If your Database["public"]["Tables"]["submissions"]["Row"]["status"] is just 'string',
// you might need to manually update it here or regenerate types from Supabase
// For example, if it's currently:
// status: string;
// Update it in the main Database interface to:
// status: 'pending' | 'verified' | 'rejected' | 'paid';
