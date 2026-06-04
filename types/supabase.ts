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
          geo_data?: {
            country: string;
            country_code: string;
            state: string;
            city: string;
            lat: number;
            lon: number;
            processed_at: string;
          } | null;
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
          geo_data?: {
            country: string;
            country_code: string;
            state: string;
            city: string;
            lat: number;
            lon: number;
            processed_at: string;
          } | null;
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
          geo_data?: {
            country: string;
            country_code: string;
            state: string;
            city: string;
            lat: number;
            lon: number;
            processed_at: string;
          } | null;
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
          twitter_account: Json | null;
          instagram_archive: Json | null;
          youtube_archive: Json | null;
          twitter_archive: Json | null;
          total_contests_participated: number;
          total_contests_won: number;
          total_money_won: number;
          withdrawable_balance: number;
          total_views: number;
          categories: Json | null;
          subcategories: Json | null;
          interests: Json | null;
          has_claimed_profile_reward: boolean;
          profile_reward_claimed_at: string | null;
          trust_score_metrics: Json;
        };
        Insert: {
          id: string;
          bio?: string | null;
          youtube_account?: Json | null;
          instagram_account?: Json | null;
          twitter_account?: Json | null;
          instagram_archive?: Json | null;
          youtube_archive?: Json | null;
          twitter_archive?: Json | null;
          total_contests_participated?: number;
          total_contests_won?: number;
          total_money_won?: number;
          withdrawable_balance?: number;
          total_views?: number;
          categories?: Json | null;
          subcategories?: Json | null;
          interests?: Json | null;
          has_claimed_profile_reward?: boolean;
          profile_reward_claimed_at?: string | null;
          trust_score_metrics?: Json;
        };
        Update: {
          id?: string;
          bio?: string | null;
          youtube_account?: Json | null;
          instagram_account?: Json | null;
          twitter_account?: Json | null;
          instagram_archive?: Json | null;
          youtube_archive?: Json | null;
          twitter_archive?: Json | null;
          total_contests_participated?: number;
          total_contests_won?: number;
          total_money_won?: number;
          withdrawable_balance?: number;
          total_views?: number;
          categories?: Json | null;
          subcategories?: Json | null;
          interests?: Json | null;
          has_claimed_profile_reward?: boolean;
          profile_reward_claimed_at?: string | null;
          trust_score_metrics?: Json;
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
          contest_type: "leaderboard" | "cpm" | "milestone" | "dual_rewards";
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
          payout_adjustment_percentage: number | null;
          payout_adjustment_mode: string | null;
          trust_score: number | null;
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
          contest_type?:
            | "leaderboard"
            | "cpm"
            | "milestone"
            | "dual_rewards";
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
          payout_adjustment_percentage?: number | null;
          payout_adjustment_mode?: string | null;
          trust_score?: number | null;
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
          contest_type?:
            | "leaderboard"
            | "cpm"
            | "milestone"
            | "dual_rewards";
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
          payout_adjustment_percentage?: number | null;
          payout_adjustment_mode?: string | null;
          trust_score?: number | null;
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
          insights_status: string | null;
          platform: string | null;
          video_id: string | null;
          video_title: string | null;
          video_thumbnail_url: string | null;
          paid: boolean;
          paid_at: string | null;
          bonus_paid: boolean;
          bonus_paid_at: string | null;
          bonus_amount: number;
          /** dual_rewards: main earnings split `{ cpm_cents, milestone_cents }` (JSON). */
          dual_rewards_payout: Json | null;
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
          insights_status?: string | null;
          platform?: string | null;
          video_id?: string | null;
          video_title?: string | null;
          video_thumbnail_url?: string | null;
          paid?: boolean;
          paid_at?: string | null;
          bonus_paid?: boolean;
          bonus_paid_at?: string | null;
          bonus_amount?: number;
          dual_rewards_payout?: Json | null;
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
          insights_status?: string | null;
          platform?: string | null;
          video_id?: string | null;
          video_title?: string | null;
          video_thumbnail_url?: string | null;
          paid?: boolean;
          paid_at?: string | null;
          bonus_paid?: boolean;
          bonus_paid_at?: string | null;
          bonus_amount?: number;
          dual_rewards_payout?: Json | null;
        };
      };
      instagram_insights_refresh_runs: {
        Row: {
          id: string;
          contest_id: string;
          status: "pending" | "running" | "completed" | "failed" | "cancelled";
          total_submissions: number;
          processed_submissions: number;
          success_count: number;
          permanent_failure_count: number;
          temporary_failure_count: number;
          skipped_recent_count: number;
          reviewed_count: number;
          current_batch_index: number;
          total_batches: number;
          started_at: string;
          finished_at: string | null;
          last_batch_completed_at: string | null;
          updated_at: string;
          error_message: string | null;
        };
        Insert: {
          id?: string;
          contest_id: string;
          status?: "pending" | "running" | "completed" | "failed" | "cancelled";
          total_submissions?: number;
          processed_submissions?: number;
          success_count?: number;
          permanent_failure_count?: number;
          temporary_failure_count?: number;
          skipped_recent_count?: number;
          reviewed_count?: number;
          current_batch_index?: number;
          total_batches?: number;
          started_at?: string;
          finished_at?: string | null;
          last_batch_completed_at?: string | null;
          updated_at?: string;
          error_message?: string | null;
        };
        Update: {
          id?: string;
          contest_id?: string;
          status?: "pending" | "running" | "completed" | "failed" | "cancelled";
          total_submissions?: number;
          processed_submissions?: number;
          success_count?: number;
          permanent_failure_count?: number;
          temporary_failure_count?: number;
          skipped_recent_count?: number;
          reviewed_count?: number;
          current_batch_index?: number;
          total_batches?: number;
          started_at?: string;
          finished_at?: string | null;
          last_batch_completed_at?: string | null;
          updated_at?: string;
          error_message?: string | null;
        };
      };
      meta_graph_app_usage_log: {
        Row: {
          id: string;
          created_at: string;
          source: "instagram_insights_batch" | "instagram_insights_cron";
          contest_id: string | null;
          run_id: string | null;
          batch_index: number | null;
          call_count: number;
          total_time: number;
          total_cputime: number;
          business_use_case: Json | null;
          raw_headers: Json | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          source: "instagram_insights_batch" | "instagram_insights_cron";
          contest_id?: string | null;
          run_id?: string | null;
          batch_index?: number | null;
          call_count?: number;
          total_time?: number;
          total_cputime?: number;
          business_use_case?: Json | null;
          raw_headers?: Json | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          source?: "instagram_insights_batch" | "instagram_insights_cron";
          contest_id?: string | null;
          run_id?: string | null;
          batch_index?: number | null;
          call_count?: number;
          total_time?: number;
          total_cputime?: number;
          business_use_case?: Json | null;
          raw_headers?: Json | null;
        };
      };
      twitter_metrics_refresh_runs: {
        Row: {
          id: string;
          contest_id: string;
          status: "pending" | "running" | "completed" | "failed" | "cancelled";
          is_raid: boolean;
          creator_scope_id: string | null;
          total_batches: number;
          current_batch_index: number;
          total_participants: number;
          processed_participants: number;
          tweets_upserted: number;
          started_at: string;
          finished_at: string | null;
          last_batch_completed_at: string | null;
          error_message: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          contest_id: string;
          status?: "pending" | "running" | "completed" | "failed" | "cancelled";
          is_raid?: boolean;
          creator_scope_id?: string | null;
          total_batches?: number;
          current_batch_index?: number;
          total_participants?: number;
          processed_participants?: number;
          tweets_upserted?: number;
          started_at?: string;
          finished_at?: string | null;
          last_batch_completed_at?: string | null;
          error_message?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          contest_id?: string;
          status?: "pending" | "running" | "completed" | "failed" | "cancelled";
          is_raid?: boolean;
          creator_scope_id?: string | null;
          total_batches?: number;
          current_batch_index?: number;
          total_participants?: number;
          processed_participants?: number;
          tweets_upserted?: number;
          started_at?: string;
          finished_at?: string | null;
          last_batch_completed_at?: string | null;
          error_message?: string | null;
          updated_at?: string;
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
          idempotency_key: string | null;
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
          idempotency_key?: string | null;
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
          idempotency_key?: string | null;
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
          payment_proof_link: string | null;
          payment_proof_storage_path: string | null;
          payment_proof_file_size_bytes: number | null;
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
          payment_proof_link?: string | null;
          payment_proof_storage_path?: string | null;
          payment_proof_file_size_bytes?: number | null;
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
          payment_proof_link?: string | null;
          payment_proof_storage_path?: string | null;
          payment_proof_file_size_bytes?: number | null;
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
          contest_type:
            | "leaderboard"
            | "cpm"
            | "milestone"
            | "dual_rewards"
            | null;
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
          trust_score: number | null;
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

/** Not stored on paid `dual_rewards` rows; payment audit + split live on `dual_rewards_payout`. */
export interface SubmissionPaymentMetadata {
  type: "payment";
  paymentProofUrl: string | null;
  paymentDescription: string | null;
  /** Optional human note; for dual_rewards see `dual_rewards_payout.customRemarks` on the row. */
  customRemarks?: string | null;
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
