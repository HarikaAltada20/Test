"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createSupabaseClient } from "@/lib/supabase/client"
import { formatMoney } from "@/lib/utils"
import { User, UserCheck } from "lucide-react"

interface UserData {
  id: string
  full_name: string
  email: string
  username: string
  user_type: string
  referred_by: string | null
  coins: number
  advertisers_referred: number
  creators_referred: number
  ip_address: string | null
}

interface CreatorProfile {
  total_contests_participated: number
  total_contests_won: number
  total_money_won: number
  withdrawable_balance: number
}

interface AdvertiserProfile {
  company_name: string | null
  website_url: string | null
  total_money_spent: number
  total_contests_run: number
  withdrawable_balance: number
  available_deposit_balance: number
  subscription_plan: string
}

export default function profilePage() {
  const [userData, setUserData] = useState<UserData | null>(null)
  const [creatorProfile, setCreatorProfile] = useState<CreatorProfile | null>(null)
  const [advertiserProfile, setAdvertiserProfile] = useState<AdvertiserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [referrer, setReferrer] = useState<string | null>(null)
  const supabase = createSupabaseClient()

  useEffect(() => {
    const fetchUserData = async () => {
      setIsLoading(true)

      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        setIsLoading(false)
        return
      }

      // Fetch user data
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (userError) {
        console.error("Error fetching user data:", userError)
        setIsLoading(false)
        return
      }

      setUserData(user as UserData)

      // If user has a referral, fetch referrer's username
      if (user.referred_by) {
        const { data: referrerData } = await supabase
          .from('users')
          .select('username')
          .eq('referral_code', user.referred_by)
          .single()

        if (referrerData) {
          setReferrer(referrerData.username)
        }
      }

      // Fetch profile based on user type
      if (user.user_type === 'creator') {
        const { data: profile, error: profileError } = await supabase
          .from('creator_profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()

        if (!profileError && profile) {
          setCreatorProfile(profile as CreatorProfile)
        }
      } else if (user.user_type === 'advertiser') {
        const { data: profile, error: profileError } = await supabase
          .from('advertiser_profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()

        if (!profileError && profile) {
          setAdvertiserProfile(profile as AdvertiserProfile)
        }
      }

      setIsLoading(false)
    }

    fetchUserData()
  }, [supabase])

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-10">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!userData) {
    return (
      <div className="text-center py-10">
        <p className="text-muted-foreground">User data not available. Please try again.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5" />
            <CardTitle>Account Information</CardTitle>
          </div>
          <CardDescription>
            Your basic account details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Full Name</p>
              <p>{userData.full_name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Email</p>
              <p>{userData.email}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Username / Referral Code</p>
              <p className="font-medium">{userData.username}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Account Type</p>
              <p className="capitalize">{userData.user_type}</p>
            </div>
            {userData.ip_address && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">IP Address</p>
                <p>{userData.ip_address}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            <CardTitle>Referral Information</CardTitle>
          </div>
          <CardDescription>
            Referral statistics and details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Referred By</p>
              <p>{referrer || "Not referred"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Available Coins</p>
              <p>{userData.coins.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Creators Referred</p>
              <p>{userData.creators_referred}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Advertisers Referred</p>
              <p>{userData.advertisers_referred}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {creatorProfile && (
        <Card>
          <CardHeader>
            <CardTitle>Creator Profile</CardTitle>
            <CardDescription>
              Your creator statistics
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Contests Participated</p>
                <p>{creatorProfile.total_contests_participated}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Contests Won</p>
                <p>{creatorProfile.total_contests_won}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Money Won</p>
                <p>{formatMoney(creatorProfile.total_money_won)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Withdrawable Balance</p>
                <p className="font-medium">{formatMoney(creatorProfile.withdrawable_balance)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {advertiserProfile && (
        <Card>
          <CardHeader>
            <CardTitle>Advertiser Profile</CardTitle>
            <CardDescription>
              Your advertiser statistics
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              {advertiserProfile.company_name && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Company Name</p>
                  <p>{advertiserProfile.company_name}</p>
                </div>
              )}
              {advertiserProfile.website_url && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Website</p>
                  <a
                    href={advertiserProfile.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {advertiserProfile.website_url}
                  </a>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-muted-foreground">Subscription Plan</p>
                <p className="capitalize">{advertiserProfile.subscription_plan}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Contests Run</p>
                <p>{advertiserProfile.total_contests_run}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Money Spent</p>
                <p>{formatMoney(advertiserProfile.total_money_spent)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Withdrawable Balance</p>
                <p>{formatMoney(advertiserProfile.withdrawable_balance)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Available Deposit Balance</p>
                <p className="font-medium">{formatMoney(advertiserProfile.available_deposit_balance)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

