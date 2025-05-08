"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { DollarSign } from "lucide-react"
import { format } from "date-fns"
import { formatMoney } from "@/lib/utils"
import { createClient } from "@/utils/supabase/client"

interface MoneyTransaction {
    id: string
    user_id: string
    type: "withdrawal" | "reward" | "deposit"
    status: "pending" | "success" | "failed"
    amount: number
    description: string
    created_at: string
}

export default function MoneyTransactionsPage() {
    const [transactions, setTransactions] = useState<MoneyTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

    useEffect(() => {
        const fetchTransactions = async () => {
            setIsLoading(true)

            const { data: { session } } = await supabase.auth.getSession()

            if (!session) {
                setIsLoading(false)
                return
            }

            const { data, error } = await supabase
                .from('money_transactions')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) {
                console.error("Error fetching transactions:", error)
            } else {
                setTransactions(data as MoneyTransaction[])
            }

            setIsLoading(false)
        }

        fetchTransactions()
    }, [supabase])

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'deposit':
                return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
            case 'reward':
                return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
            case 'withdrawal':
                return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
            default:
                return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'success':
                return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
            case 'pending':
                return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
            case 'failed':
                return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
            default:
                return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
        }
    }

    return (
        <Card className="w-full">
            <CardHeader>
                <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-green-500" />
                    <CardTitle>Money Transactions</CardTitle>
                </div>
                <CardDescription>
                    History of all your money transactions
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center items-center py-6">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                ) : transactions.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                        No money transactions found
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {transactions.map((transaction) => (
                                <TableRow key={transaction.id}>
                                    <TableCell>
                                        {format(new Date(transaction.created_at), 'MMM d, yyyy h:mm a')}
                                    </TableCell>
                                    <TableCell>{transaction.description}</TableCell>
                                    <TableCell>
                                        <Badge className={getTypeColor(transaction.type)}>
                                            {transaction.type}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={getStatusColor(transaction.status)}>
                                            {transaction.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                        {transaction.type === 'withdrawal' ? '-' : '+'}{formatMoney(transaction.amount)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    )
} 