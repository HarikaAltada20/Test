"use client"

import type React from "react"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { createSupabaseClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Separate the component that uses useSearchParams
function SettingsContent() {
  const [profileData, setProfileData] = useState<any>(null)
  const [youtubeAccount, setYoutubeAccount] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const router = useRouter()
  const { user } = useAuth()
  const supabase = createSupabaseClient()
  const searchParams = useSearchParams()

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        // Get user data
        const { data: userData, error: userError } = await supabase.from("users").select("*").eq("id", user.id).single()

        if (userError) {
          console.error("User data fetch error:", userError)
          throw new Error("Failed to load user data. Please try again.")
        }

        if (!userData) {
          setIsLoading(false)
          throw new Error("No user data found")
        }

        // Get role-specific profile data
        if (userData.role === "advertiser") {
          const { data: advertiserData, error: advertiserError } = await supabase
            .from("advertiser_profiles")
            .select("*")
            .eq("user_id", user.id)
            .maybeSingle()

          if (advertiserError && !advertiserError.message.includes("No rows found")) {
            console.error("Advertiser profile fetch error:", advertiserError)
            throw new Error("Failed to load advertiser profile. Please try again.")
          }

          setProfileData({
            ...userData,
            ...(advertiserData || {}),
            role: "advertiser",
          })
        } else {
          const { data: creatorData, error: creatorError } = await supabase
            .from("creator_profiles")
            .select("*")
            .eq("user_id", user.id)
            .maybeSingle()

          if (creatorError) {
            console.error("Creator profile fetch error:", creatorError)
            // Only throw if it's not a "no rows" error
            if (!creatorError.message.includes("No rows found") &&
              !creatorError.code?.includes("PGRST116")) {
              throw new Error("Failed to load creator profile. Please try again.")
            }
          }

          // Even if no creator profile was found, we still proceed with the user data
          setProfileData({
            ...userData,
            ...(creatorData || {}),
            role: "creator",
          })
        }
      } catch (err: any) {
        console.error("Profile fetch error:", err)
        setError(err.message || "Failed to load profile")
      } finally {
        setIsLoading(false)
      }
    }

    fetchProfile()
  }, [user, supabase])

  useEffect(() => {
    // Check for YouTube connection status from URL parameters
    const youtubeConnected = searchParams.get('youtube_connected')
    const youtubeError = searchParams.get('error')

    if (youtubeConnected === 'true') {
      setSuccess('YouTube account connected successfully!')
      // Remove the parameter from URL to prevent showing the message on refresh
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.delete('youtube_connected')
      window.history.replaceState({}, '', newUrl.toString())
    } else if (youtubeError) {
      setError('Failed to connect YouTube account. Please try again.')
      // Remove the parameter from URL
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.delete('error')
      window.history.replaceState({}, '', newUrl.toString())
    }
  }, [searchParams])

  useEffect(() => {
    // Fetch YouTube account information if user is a creator
    const fetchYouTubeAccount = async () => {
      if (!user || profileData?.role !== 'creator') return

      try {
        const { data, error } = await supabase
          .from('creator_youtube_accounts')
          .select('*')
          .eq('creator_id', user.id)
          .single()

        if (!error) {
          setYoutubeAccount(data)
        }
      } catch (err) {
        console.error('Error fetching YouTube account:', err)
      }
    }

    if (profileData) {
      fetchYouTubeAccount()
    }
  }, [user, profileData, supabase])

  const handleUserUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setIsSaving(true)

    try {
      // Update user data
      const { error: userError } = await supabase
        .from("users")
        .update({
          email: profileData.email,
          profile_pic: profileData.profile_pic,
        })
        .eq("id", user?.id)

      if (userError) throw userError

      // Update role-specific data
      if (profileData.role === "advertiser") {
        const { error: advertiserError } = await supabase
          .from("advertiser_profiles")
          .update({
            company_name: profileData.company_name,
            logo_url: profileData.logo_url,
            website: profileData.website,
            social_media_handles: profileData.social_media_handles || {},
          })
          .eq("user_id", user?.id)

        if (advertiserError) throw advertiserError
      } else {
        const { error: creatorError } = await supabase
          .from("creator_profiles")
          .update({
            username: profileData.username,
            bio: profileData.bio,
            linked_platforms: profileData.linked_platforms || {},
          })
          .eq("user_id", user?.id)

        if (creatorError) throw creatorError
      }

      setSuccess("Profile updated successfully")
    } catch (err: any) {
      setError(err.message || "Failed to update profile")
    } finally {
      setIsSaving(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target
    setProfileData((prev: any) => ({
      ...prev,
      [id]: value,
    }))
  }

  const handleDisconnectYouTube = async () => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('creator_youtube_accounts')
        .delete()
        .eq('creator_id', user.id)

      if (error) throw error

      setYoutubeAccount(null)
      setSuccess('YouTube account disconnected successfully')
    } catch (err: any) {
      setError(err.message || 'Failed to disconnect YouTube account')
    }
  }

  if (isLoading || !profileData) {
    return (
      <div className="flex items-center justify-center h-64">
        <p>Loading profile...</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          {profileData?.role === 'creator' && (
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile Settings</CardTitle>
              <CardDescription>Update your profile information visible to others on the platform</CardDescription>
            </CardHeader>
            <form onSubmit={handleUserUpdate}>
              <CardContent className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {success && (
                  <Alert className="bg-green-50 text-green-800">
                    <AlertDescription>{success}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={profileData.email || ""}
                    onChange={handleInputChange}
                    disabled
                    placeholder="email@example.com"
                  />
                </div>

                {profileData.role === "advertiser" ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="company_name">Company Name</Label>
                      <Input
                        id="company_name"
                        value={profileData.company_name || ""}
                        onChange={handleInputChange}
                        placeholder="Your company name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="website">Website</Label>
                      <Input
                        id="website"
                        value={profileData.website || ""}
                        onChange={handleInputChange}
                        placeholder="https://example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="logo_url">Logo URL</Label>
                      <Input
                        id="logo_url"
                        value={profileData.logo_url || ""}
                        onChange={handleInputChange}
                        placeholder="https://example.com/logo.png"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-2"></div>
                    <div className="space-y-2">
                      <Label htmlFor="username">Username</Label>
                      <Input
                        id="username"
                        value={profileData.username || ""}
                        onChange={handleInputChange}
                        placeholder="Your username"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bio">Bio</Label>
                      <Textarea
                        id="bio"
                        value={profileData.bio || ""}
                        onChange={handleInputChange}
                        placeholder="Tell us about yourself"
                        rows={4}
                      />
                    </div>
                  </>
                )}
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        <TabsContent value="account">
          <Card>
            <CardHeader>
              <CardTitle>Account Settings</CardTitle>
              <CardDescription>Manage your account settings and preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="flex space-x-2">
                  <Input id="password" type="password" value="••••••••" disabled />
                  <Button variant="outline">Change</Button>
                </div>
              </div>

              {profileData.role === "creator" && (
                <div className="space-y-2">
                  <Label htmlFor="payment">Payment Information</Label>
                  <div className="flex space-x-2">
                    <Input id="payment" value="••••••••" disabled />
                    <Button variant="outline">Update</Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Add or update your payment details to receive payments for contest winnings
                  </p>
                </div>
              )}

              <div className="pt-4">
                <Button variant="destructive">Delete Account</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>Configure how you want to be notified</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Email Notifications</h3>
                  <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                </div>
                <div>
                  <Button variant="outline">Configure</Button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Push Notifications</h3>
                  <p className="text-sm text-muted-foreground">Receive notifications in your browser</p>
                </div>
                <div>
                  <Button variant="outline">Configure</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {profileData?.role === 'creator' && (
          <TabsContent value="integrations">
            <Card>
              <CardHeader>
                <CardTitle>YouTube Integration</CardTitle>
                <CardDescription>
                  Connect your YouTube account to submit content and track metrics automatically.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {success && (
                  <Alert className="bg-green-50 text-green-800">
                    <AlertDescription>{success}</AlertDescription>
                  </Alert>
                )}

                {youtubeAccount ? (
                  <div className="space-y-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="font-medium mb-2">Connected YouTube Channel</h3>
                      <p className="text-sm mb-1"><strong>Channel:</strong> {youtubeAccount.channel_title}</p>
                      <p className="text-sm mb-1"><strong>Channel ID:</strong> {youtubeAccount.channel_id}</p>
                      <p className="text-sm text-muted-foreground">
                        Connected on {new Date(youtubeAccount.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex justify-end">
                      <Button variant="destructive" onClick={handleDisconnectYouTube}>
                        Disconnect YouTube Account
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="mb-4">
                      Connect your YouTube account to automatically verify video ownership and track metrics.
                    </p>
                    <Button asChild>
                      <a href="/api/youtube/auth">Connect YouTube Account</a>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

// Main component with Suspense boundary
export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-4 text-center">Loading settings...</div>}>
      <SettingsContent />
    </Suspense>
  );
}

