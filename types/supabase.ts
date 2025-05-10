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
          brief: string | null
          rules: Json
          prizes: Json
          resources: Json
          category: string | null
          inspiration_links: string | null
          total_prize: number
          winner_count: number
          created_at: string
          is_draft: boolean
          subscription_plan_of_user: string | null
        }
        Insert: {
          id?: string
          advertiser_id: string
          title: string
          platform: string
          start_date?: string | null
          end_date?: string | null
          thumbnail_url?: string | null
          brief?: string | null
          rules?: Json
          prizes?: Json
          resources?: Json
          category?: string | null
          inspiration_links?: string | null
          total_prize?: number
          winner_count?: number
          created_at?: string
          is_draft?: boolean
          subscription_plan_of_user?: string | null
        }
        Update: {
          id?: string
          advertiser_id?: string
          title?: string
          platform?: string
          start_date?: string | null
          end_date?: string | null
          thumbnail_url?: string | null
          brief?: string | null
          rules?: Json
          prizes?: Json
          resources?: Json
          category?: string | null
          inspiration_links?: string | null
          total_prize?: number
          winner_count?: number
          created_at?: string
          is_draft?: boolean
          subscription_plan_of_user?: string | null
        }
      }
      submissions: {
        Row: {
          id: string
          contest_id: string
          creator_id: string
          video_url: string
          views: number
          description: string | null
          other_stats: Json | null
          created_at: string
          status: string
          earnings: number
        }
        Insert: {
          id?: string
          contest_id: string
          creator_id: string
          video_url: string
          views?: number
          description?: string | null
          other_stats?: Json | null
          created_at?: string
          status?: string
          earnings?: number
        }
        Update: {
          id?: string
          contest_id?: string
          creator_id?: string
          video_url?: string
          views?: number
          description?: string | null
          other_stats?: Json | null
          created_at?: string
          status?: string
          earnings?: number
        }
      }
      money_transactions: {
        Row: {
          id: string
          user_id: string
          type: "withdrawal" | "reward" | "deposit"
          status: "pending" | "success" | "failed"
          amount: number
          description: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: "withdrawal" | "reward" | "deposit"
          status: "pending" | "success" | "failed"
          amount: number
          description: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: "withdrawal" | "reward" | "deposit"
          status?: "pending" | "success" | "failed"
          amount?: number
          description?: string
          created_at?: string
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
          status: "pending" | "success" | "failed"
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
    }
    Views: {
      contests_with_status: {
        Row: {
          id: string
          advertiser_id: string
          title: string
          platform: string
          start_date: string | null
          end_date: string | null
          thumbnail_url: string | null
          brief: string | null
          rules: Json
          prizes: Json
          resources: Json
          created_at: string
          status: "upcoming" | "live" | "past" | "draft"
          is_draft: boolean
          category: string | null
          inspiration_links: string | null
          total_prize: number
          winner_count: number
          subscription_plan_of_user: string | null
        }
      }
    }
  }
}

