export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          profile_pic: string | null
          role: "advertiser" | "creator"
          wallet_balance: number
          currency_code: string
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          profile_pic?: string | null
          role: "advertiser" | "creator"
          wallet_balance?: number
          currency_code?: string
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          profile_pic?: string | null
          role?: "advertiser" | "creator"
          wallet_balance?: number
          currency_code?: string
          created_at?: string
        }
      }
      advertiser_profiles: {
        Row: {
          user_id: string
          company_name: string
          logo_url: string | null
          website: string | null
          social_media_handles: Json
          total_contests_organized: number
          total_spent: number
        }
        Insert: {
          user_id: string
          company_name: string
          logo_url?: string | null
          website?: string | null
          social_media_handles?: Json
          total_contests_organized?: number
          total_spent?: number
        }
        Update: {
          user_id?: string
          company_name?: string
          logo_url?: string | null
          website?: string | null
          social_media_handles?: Json
          total_contests_organized?: number
          total_spent?: number
        }
      }
      creator_profiles: {
        Row: {
          user_id: string
          username: string
          bio: string | null
          linked_platforms: Json
          contests_won: number
          contests_participated: number
          prize_money_earned: number
        }
        Insert: {
          user_id: string
          username: string
          bio?: string | null
          linked_platforms?: Json
          contests_won?: number
          contests_participated?: number
          prize_money_earned?: number
        }
        Update: {
          user_id?: string
          username?: string
          bio?: string | null
          linked_platforms?: Json
          contests_won?: number
          contests_participated?: number
          prize_money_earned?: number
        }
      }
      contests: {
        Row: {
          id: string
          advertiser_id: string
          title: string
          platform: "youtube" | "instagram"
          start_date: string | null
          end_date: string | null
          thumbnail_url: string | null
          brief: string | null
          rules: Json
          prizes: Json
          resources: Json
          created_at: string
        }
        Insert: {
          id?: string
          advertiser_id: string
          title: string
          platform: "youtube" | "instagram"
          start_date?: string | null
          end_date?: string | null
          thumbnail_url?: string | null
          brief?: string | null
          rules?: Json
          prizes: Json
          resources?: Json
          created_at?: string
        }
        Update: {
          id?: string
          advertiser_id?: string
          title?: string
          platform?: "youtube" | "instagram"
          start_date?: string | null
          end_date?: string | null
          thumbnail_url?: string | null
          brief?: string | null
          rules?: Json
          prizes?: Json
          resources?: Json
          created_at?: string
        }
      }
      submissions: {
        Row: {
          id: string
          contest_id: string
          creator_id: string
          content_link: string
          current_views: number
          status: "pending" | "approved" | "rejected"
          submitted_at: string
        }
        Insert: {
          id?: string
          contest_id: string
          creator_id: string
          content_link: string
          current_views?: number
          status?: "pending" | "approved" | "rejected"
          submitted_at?: string
        }
        Update: {
          id?: string
          contest_id?: string
          creator_id?: string
          content_link?: string
          current_views?: number
          status?: "pending" | "approved" | "rejected"
          submitted_at?: string
        }
      }
    }
    Views: {
      contests_with_status: {
        Row: {
          id: string
          advertiser_id: string
          title: string
          platform: "youtube" | "instagram"
          start_date: string | null
          end_date: string | null
          thumbnail_url: string | null
          brief: string | null
          rules: Json
          prizes: Json
          resources: Json
          created_at: string
          status: "upcoming" | "live" | "past"
        }
      }
    }
  }
}

