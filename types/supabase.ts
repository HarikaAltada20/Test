export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          full_name: string | null
          profile_picture_url: string | null
          user_type: "advertiser" | "creator"
          referral_code: string | null
          referred_by: string | null
          coins: number
          advertisers_referred: number
          creators_referred: number
          username: string | null
          is_active: boolean
          ip_address: string | null
          email_confirmed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          full_name?: string | null
          profile_picture_url?: string | null
          user_type: "advertiser" | "creator"
          referral_code?: string | null
          referred_by?: string | null
          coins?: number
          advertisers_referred?: number
          creators_referred?: number
          username?: string | null
          is_active?: boolean
          ip_address?: string | null
          email_confirmed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          profile_picture_url?: string | null
          user_type?: "advertiser" | "creator"
          referral_code?: string | null
          referred_by?: string | null
          coins?: number
          advertisers_referred?: number
          creators_referred?: number
          username?: string | null
          is_active?: boolean
          ip_address?: string | null
          email_confirmed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      advertiser_profiles: {
        Row: {
          id: string
          company_name: string | null
          website_url: string | null
          total_money_spent: number
          total_contests_run: number
          available_deposit_balance: number
          withdrawable_balance: number
          subscription_plan: string
        }
        Insert: {
          id: string
          company_name?: string | null
          website_url?: string | null
          total_money_spent?: number
          total_contests_run?: number
          available_deposit_balance?: number
          withdrawable_balance?: number
          subscription_plan?: string
        }
        Update: {
          id?: string
          company_name?: string | null
          website_url?: string | null
          total_money_spent?: number
          total_contests_run?: number
          available_deposit_balance?: number
          withdrawable_balance?: number
          subscription_plan?: string
        }
      }
      creator_profiles: {
        Row: {
          id: string
          bio: string | null
          youtube_account: Json | null
          instagram_account: Json | null
          total_contests_participated: number
          total_contests_won: number
          total_money_won: number
          withdrawable_balance: number
          total_views: number
        }
        Insert: {
          id: string
          bio?: string | null
          youtube_account?: Json | null
          instagram_account?: Json | null
          total_contests_participated?: number
          total_contests_won?: number
          total_money_won?: number
          withdrawable_balance?: number
          total_views?: number
        }
        Update: {
          id?: string
          bio?: string | null
          youtube_account?: Json | null
          instagram_account?: Json | null
          total_contests_participated?: number
          total_contests_won?: number
          total_money_won?: number
          withdrawable_balance?: number
          total_views?: number
        }
      }
      subscription_plans: {
        Row: {
          id: string
          name: string
          price: number
          json_features: Json
          stripe_price_id: string | null
          razorpay_plan_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          price: number
          json_features: Json
          stripe_price_id?: string | null
          razorpay_plan_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          price?: number
          json_features?: Json
          stripe_price_id?: string | null
          razorpay_plan_id?: string | null
          created_at?: string
        }
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string
          plan_id: string
          gateway: "stripe" | "razorpay"
          external_subscription_id: string | null
          status: string
          start_date: string
          expiry_date: string
          renews_on: string | null
          cancel_at_period_end: boolean
          trial_end: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          plan_id: string
          gateway: "stripe" | "razorpay"
          external_subscription_id?: string | null
          status: string
          start_date: string
          expiry_date: string
          renews_on?: string | null
          cancel_at_period_end?: boolean
          trial_end?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          plan_id?: string
          gateway?: "stripe" | "razorpay"
          external_subscription_id?: string | null
          status?: string
          start_date?: string
          expiry_date?: string
          renews_on?: string | null
          cancel_at_period_end?: boolean
          trial_end?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      contests: {
        Row: {
          id: string
          advertiser_id: string
          title: string
          platform: string
          start_date: string | null
          end_date: string | null
          thumbnail_url: string | null
          brief_html: string | null
          brief_json: Json | null
          rules_html: string | null
          rules_json: Json | null
          resources: Json | null
          category: string | null
          inspiration_links: string[] | null
          created_at: string
          updated_at: string
          subscription_plan_of_user: string | null
          contest_type: 'leaderboard' | 'cpm'
          contest_based_details: Json | null
          post_contest_status: 'pending_review' | 'in_review' | 'verification_complete' | 'payouts_processed' | null
          live_submission_count: number | null
          last_metrics_updated: string | null
          moderation_status: 'draft' | 'pending_approval' | 'approved' | 'published' | 'rejected'
          submitted_for_approval_at: string | null
          approved_at: string | null
          approved_by: string | null
          published_at: string | null
          rejection_reason: string | null
        }
        Insert: {
          id?: string
          advertiser_id: string
          title: string
          platform: string
          start_date?: string | null
          end_date?: string | null
          thumbnail_url?: string | null
          brief_html?: string | null
          brief_json?: Json | null
          rules_html?: string | null
          rules_json?: Json | null
          resources?: Json | null
          category?: string | null
          inspiration_links?: string[] | null
          created_at?: string
          updated_at?: string
          subscription_plan_of_user?: string | null
          contest_type?: 'leaderboard' | 'cpm'
          contest_based_details?: Json | null
          post_contest_status?: 'pending_review' | 'in_review' | 'verification_complete' | 'payouts_processed' | null
          live_submission_count?: number | null
          last_metrics_updated?: string | null
          moderation_status?: 'draft' | 'pending_approval' | 'approved' | 'published' | 'rejected'
          submitted_for_approval_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          published_at?: string | null
          rejection_reason?: string | null
        }
        Update: {
          id?: string
          advertiser_id?: string
          title?: string
          platform?: string
          start_date?: string | null
          end_date?: string | null
          thumbnail_url?: string | null
          brief_html?: string | null
          brief_json?: Json | null
          rules_html?: string | null
          rules_json?: Json | null
          resources?: Json | null
          category?: string | null
          inspiration_links?: string[] | null
          created_at?: string
          updated_at?: string
          subscription_plan_of_user?: string | null
          contest_type?: 'leaderboard' | 'cpm'
          contest_based_details?: Json | null
          post_contest_status?: 'pending_review' | 'in_review' | 'verification_complete' | 'payouts_processed' | null
          live_submission_count?: number | null
          last_metrics_updated?: string | null
          moderation_status?: 'draft' | 'pending_approval' | 'approved' | 'published' | 'rejected'
          submitted_for_approval_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          published_at?: string | null
          rejection_reason?: string | null
        }
      }
      submissions: {
        Row: {
          id: string
          contest_id: string
          creator_id: string
          content_link: string
          views: number
          description: string | null
          other_stats: Json | null
          created_at: string
          status: 'pending' | 'verified' | 'rejected' | 'paid'
          earnings: number
          last_insights_update: string | null
          platform: string | null
          video_id: string | null
          video_title: string | null
          video_thumbnail_url: string | null
        }
        Insert: {
          id?: string
          contest_id: string
          creator_id: string
          content_link: string
          views?: number
          description?: string | null
          other_stats?: Json | null
          created_at?: string
          status?: 'pending' | 'verified' | 'rejected' | 'paid'
          earnings?: number
          last_insights_update?: string | null
          platform?: string | null
          video_id?: string | null
          video_title?: string | null
          video_thumbnail_url?: string | null
        }
        Update: {
          id?: string
          contest_id?: string
          creator_id?: string
          content_link?: string
          views?: number
          description?: string | null
          other_stats?: Json | null
          created_at?: string
          status?: 'pending' | 'verified' | 'rejected' | 'paid'
          earnings?: number
          last_insights_update?: string | null
          platform?: string | null
          video_id?: string | null
          video_title?: string | null
          video_thumbnail_url?: string | null
        }
      }
      money_transactions: {
        Row: {
          id: string
          user_id: string
          type: "withdrawal" | "reward" | "deposit" | "contest_payment" | "refund"
          status: "pending" | "success" | "failed" | "cancelled"
          amount: number
          description: string | null
          created_at: string
          updated_at: string
          currency: string | null
          withdrawal_request_id: string | null
          remarks: string | null
        }
        Insert: {
          id?: string
          user_id: string
          type: "withdrawal" | "reward" | "deposit" | "contest_payment" | "refund"
          status?: "pending" | "success" | "failed" | "cancelled"
          amount: number
          description?: string | null
          created_at?: string
          updated_at?: string
          currency?: string | null
          withdrawal_request_id?: string | null
          remarks?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          type?: "withdrawal" | "reward" | "deposit" | "contest_payment" | "refund"
          status?: "pending" | "success" | "failed" | "cancelled"
          amount?: number
          description?: string | null
          created_at?: string
          updated_at?: string
          currency?: string | null
          withdrawal_request_id?: string | null
          remarks?: string | null
        }
      }
      coin_transactions: {
        Row: {
          id: string
          user_id: string
          type: "referral_bonus" | "spent" | "earned" | "bonus"
          status: "pending" | "success" | "failed"
          coins: number
          description: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: "referral_bonus" | "spent" | "earned" | "bonus"
          status?: "pending" | "success" | "failed"
          coins: number
          description: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: "referral_bonus" | "spent" | "earned" | "bonus"
          status?: "pending" | "success" | "failed"
          coins?: number
          description?: string
          created_at?: string
        }
      }
      withdrawal_requests: {
        Row: {
          id: string 
          user_id: string 
          payout_method_id: string | null
          amount_cents: number 
          currency: string 
          status: "pending" | "approved" | "rejected" | "processed" | "failed" | "cancelled"
          processed_at: string | null
          transaction_reference: string | null
          admin_notes: string | null 
          user_notes: string | null 
          created_at: string 
          updated_at: string 
          amount_type: "cash" | "coins"
          payout_method_type_snapshot: string | null 
          payout_method_details_snapshot: Json | null 
          cancelled_at: string | null 
          cancellation_reason: string | null 
        }
        Insert: {
          id?: string 
          user_id: string 
          payout_method_id?: string | null
          amount_cents: number 
          currency?: string 
          status?: "pending" | "approved" | "rejected" | "processed" | "failed" | "cancelled" 
          processed_at?: string | null
          transaction_reference?: string | null
          admin_notes?: string | null 
          user_notes?: string | null 
          created_at?: string 
          updated_at?: string 
          amount_type: "cash" | "coins"
          payout_method_type_snapshot?: string | null 
          payout_method_details_snapshot?: Json | null 
        }
        Update: {
          id?: string 
          user_id?: string 
          payout_method_id?: string | null 
          amount_cents?: number 
          currency?: string 
          status?: "pending" | "approved" | "rejected" | "processed" | "failed" | "cancelled" 
          processed_at?: string | null
          transaction_reference?: string | null
          admin_notes?: string | null 
          user_notes?: string | null 
          created_at?: string 
          updated_at?: string 
          amount_type?: "cash" | "coins" 
          payout_method_type_snapshot?: string | null 
          payout_method_details_snapshot?: Json | null 
          cancelled_at?: string | null 
          cancellation_reason?: string | null 
        }
      }
    }
    Views: {
      contests_with_status: {
        Row: {
          id: string | null 
          advertiser_id: string | null
          title: string | null
          platform: string | null
          start_date: string | null
          end_date: string | null
          thumbnail_url: string | null
          brief_html: string | null
          brief_json: Json | null
          rules_html: string | null
          rules_json: Json | null
          resources: Json | null
          category: string | null
          inspiration_links: string[] | null
          created_at: string | null
          updated_at: string | null
          subscription_plan_of_user: string | null
          contest_type: 'leaderboard' | 'cpm' | null
          contest_based_details: Json | null
          post_contest_status: 'pending_review' | 'in_review' | 'verification_complete' | 'payouts_processed' | null
          live_submission_count: number | null
          last_metrics_updated: string | null
          // Moderation status (admin approval workflow)
          moderation_status: 'draft' | 'pending_approval' | 'approved' | 'published' | 'rejected' | null
          submitted_for_approval_at: string | null
          approved_at: string | null
          approved_by: string | null
          published_at: string | null
          rejection_reason: string | null
          // Contest lifecycle status (only for published contests) 
          status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'incomplete' | 'upcoming' | 'active' | 'ended' | 'unknown' | null
        }
      }
    }
    Functions: {
      // ... functions ...
    }
  }
}

// Helper type for submissions with contest details
export type SubmissionWithContest = Database["public"]["Tables"]["submissions"]["Row"] & {
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
}

// Ensure the submission status type reflects the ENUM from your database
// If your Database["public"]["Tables"]["submissions"]["Row"]["status"] is just 'string',
// you might need to manually update it here or regenerate types from Supabase
// For example, if it's currently:
// status: string;
// Update it in the main Database interface to:
// status: 'pending' | 'verified' | 'rejected' | 'paid';

