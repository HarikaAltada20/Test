"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Coins, DollarSign, History } from "lucide-react"
import { useRouter } from "next/navigation"
import { formatMoney } from "@/lib/utils"

interface WalletSummaryProps {
    userType: "creator" | "advertiser"
    coins: number
    withdrawableBalance: number
    depositBalance?: number
}

export function WalletSummary({ userType, coins, withdrawableBalance, depositBalance = 0 }: WalletSummaryProps) {
    const router = useRouter()
    const [activeTab, setActiveTab] = useState<string>("wallet")

    const viewCoinHistory = () => {
        router.push("/dashboard/coin-transactions")
    }

    const viewTransactionHistory = () => {
        router.push("/dashboard/money-transactions")
    }

    return (
        <Card className="w-full">
            <CardHeader className="pb-3">
                <CardTitle>My Wallet</CardTitle>
                <CardDescription>
                    Manage your funds and rewards
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="wallet" value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="wallet" className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4" />
                            Money
                        </TabsTrigger>
                        <TabsTrigger value="coins" className="flex items-center gap-2">
                            <Coins className="h-4 w-4" />
                            Coins
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="wallet" className="space-y-4 pt-4">
                        <div className="space-y-4">
                            <div className="flex flex-col">
                                <span className="text-sm text-muted-foreground mb-1">Withdrawable Balance</span>
                                <span className="text-3xl font-bold">{formatMoney(withdrawableBalance)}</span>
                            </div>

                            {userType === "advertiser" && (
                                <>
                                    <Separator />
                                    <div className="flex flex-col">
                                        <span className="text-sm text-muted-foreground mb-1">Available for Campaigns</span>
                                        <span className="text-3xl font-bold">{formatMoney(depositBalance)}</span>
                                    </div>
                                </>
                            )}

                            <div className="flex justify-end mt-4">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex items-center gap-1"
                                    onClick={viewTransactionHistory}
                                >
                                    <History className="h-4 w-4" />
                                    Transaction History
                                </Button>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="coins" className="pt-4">
                        <div className="space-y-4">
                            <div className="flex flex-col">
                                <span className="text-sm text-muted-foreground mb-1">Available Coins</span>
                                <span className="text-3xl font-bold flex items-center gap-2">
                                    {coins.toLocaleString()}
                                    <Coins className="h-6 w-6 text-amber-500" />
                                </span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Use coins to boost your {userType === "creator" ? "submissions" : "campaigns"} or redeem them for rewards.
                            </p>

                            <div className="flex justify-end mt-4">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex items-center gap-1"
                                    onClick={viewCoinHistory}
                                >
                                    <History className="h-4 w-4" />
                                    Coin History
                                </Button>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    )
} 