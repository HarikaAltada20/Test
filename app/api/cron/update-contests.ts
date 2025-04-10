import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { Database } from '@/types/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: Request) {
  // This should be protected with some form of authentication for production use
  // For example, you could check for a specific API key in the headers
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: 'Missing Supabase credentials' },
      { status: 500 }
    )
  }

  // Initialize Supabase client with service role for admin privileges
  const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)
  
  const now = new Date().toISOString()
  
  try {
    // Since we're using a database view to calculate status, we just need to 
    // fetch contests that need notifications or status-based actions
    
    // 1. Fetch contests that just became live (start date just passed)
    // We'll get contests that started in the last 15 minutes
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()
    
    const { data: justLiveContests, error: liveQueryError } = await supabase
      .from('contests')
      .select('id, title, advertiser_id')
      .lt('start_date', now)                // Start date is before now
      .gt('start_date', fifteenMinutesAgo)  // But started recently (last 15 minutes)
      .gt('end_date', now)                  // End date is still in future
      .is('is_draft', false)                // Not a draft
    
    if (liveQueryError) {
      console.error('Error querying contests that just went live:', liveQueryError)
    } else if (justLiveContests && justLiveContests.length > 0) {
      console.log(`${justLiveContests.length} contests just went live, sending notifications`)
      
      // Here you could send notifications to eligible participants
      // This would typically involve:
      // 1. Identifying eligible creators
      // 2. Creating notifications in a notifications table
      // 3. Potentially sending push notifications or emails
      
      for (const contest of justLiveContests) {
        // Example: Insert a notification for each contest that just went live
        const { error: notifError } = await supabase
          .from('notifications')
          .insert({
            title: 'Contest Now Live',
            message: `The contest "${contest.title}" is now live and accepting submissions!`,
            type: 'contest_live',
            reference_id: contest.id,
            // You would typically have logic to determine which users should receive this
            // For simplicity, we're not including user_id here
          })
        
        if (notifError) {
          console.error(`Error creating notification for contest ${contest.id}:`, notifError)
        }
      }
    }
    
    // 2. Fetch contests that just ended (end date just passed)
    // We'll get contests that ended in the last 15 minutes
    const { data: justEndedContests, error: endedQueryError } = await supabase
      .from('contests')
      .select('id, title, advertiser_id')
      .lt('end_date', now)                  // End date is before now
      .gt('end_date', fifteenMinutesAgo)    // But ended recently (last 15 minutes)
      .is('is_draft', false)                // Not a draft
    
    if (endedQueryError) {
      console.error('Error querying contests that just ended:', endedQueryError)
    } else if (justEndedContests && justEndedContests.length > 0) {
      console.log(`${justEndedContests.length} contests just ended, sending notifications`)
      
      // Here you would send notifications to the contest owner and participants
      for (const contest of justEndedContests) {
        // Example: Insert a notification for the contest owner
        const { error: notifError } = await supabase
          .from('notifications')
          .insert({
            title: 'Contest Ended',
            message: `Your contest "${contest.title}" has ended. You can now review submissions.`,
            type: 'contest_ended',
            reference_id: contest.id,
            user_id: contest.advertiser_id // Send to the contest creator
          })
        
        if (notifError) {
          console.error(`Error creating notification for contest ${contest.id}:`, notifError)
        }
        
        // You would also notify participants who submitted to the contest
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Contest statuses checked and notifications sent',
      justLiveContestsCount: justLiveContests?.length || 0,
      justEndedContestsCount: justEndedContests?.length || 0
    })
  } catch (error) {
    console.error('Error updating contest statuses:', error)
    return NextResponse.json(
      { error: 'Failed to update contest statuses' },
      { status: 500 }
    )
  }
} 