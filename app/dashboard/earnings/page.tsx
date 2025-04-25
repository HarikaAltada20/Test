import { createSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowDownToLine, DollarSign, Trophy } from "lucide-react"

// Add the formatCurrency utility function
// Add this utility function to convert cents to dollars for display
const formatCurrency = (cents: number): string => {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function CreatorEarningsPage() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect("/login")
  }

  // Get user role from the database
  const { data: userData } = await supabase.from("users").select("user_type").eq("id", session.user.id).single()

  if (userData?.user_type !== "creator") {
    redirect("/dashboard")
  }

  // Get creator profile
  const { data: profile } = await supabase.from("creator_profiles").select("*").eq("id", session.user.id).single()

  // Get successful submissions (to simulate earnings)
  const { data: submissions } = await supabase
    .from("submissions")
    .select("*, contests(title, prizes)")
    .eq("creator_id", session.user.id)
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  // Mock earnings data
  const earnings = [
    {
      id: "earning-1",
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
      contest: "Summer Product Launch",
      amount: 15000,
      status: "paid",
    },
    {
      id: "earning-2",
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15).toISOString(),
      contest: "Holiday Campaign",
      amount: 10000,
      status: "pending",
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Earnings</h1>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/settings">
            <DollarSign className="h-4 w-4 mr-2" /> Update Payment Info
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(profile?.prize_money_earned || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Lifetime earnings</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contests Won</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{profile?.contests_won || 0}</div>
            <p className="text-xs text-muted-foreground">Total contest victories</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available for Withdrawal</CardTitle>
            <ArrowDownToLine className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(earnings.filter((e) => e.status === "pending").reduce((sum, e) => sum + e.amount, 0))}
            </div>
            <p className="text-xs text-muted-foreground">Current balance</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Earnings History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Contest</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {earnings.length > 0 ? (
                earnings.map((earning) => (
                  <TableRow key={earning.id}>
                    <TableCell>{new Date(earning.date).toLocaleDateString()}</TableCell>
                    <TableCell>{earning.contest}</TableCell>
                    <TableCell>{formatCurrency(earning.amount)}</TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${earning.status === "paid" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                          }`}
                      >
                        {earning.status === "paid" ? "Paid" : "Pending"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                    No earnings yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

