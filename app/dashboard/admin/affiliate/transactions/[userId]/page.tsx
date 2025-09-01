"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Tx = { id: string; type: string; status: string; amount: number; description?: string | null; remarks?: string | null; created_at: string };

export default function AffiliateTransactionsPage() {
    const params = useParams<{ userId: string }>();
    const userId = params?.userId as string;
    const [items, setItems] = useState<Tx[]>([]);
    const [loading, setLoading] = useState(false);

    const load = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/admin/affiliate/transactions/${userId}`);
            const json = await res.json();
            setItems(json.items || []);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { if (userId) load(); }, [userId]);

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Affiliate Transactions</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Remarks</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.map(tx => (
                                    <TableRow key={tx.id}>
                                        <TableCell>{new Date(tx.created_at).toLocaleString()}</TableCell>
                                        <TableCell>${(tx.amount / 100).toFixed(2)}</TableCell>
                                        <TableCell>{tx.status}</TableCell>
                                        <TableCell>{tx.description || '-'}</TableCell>
                                        <TableCell>{tx.remarks || '-'}</TableCell>
                                    </TableRow>
                                ))}
                                {items.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">No affiliate transactions found.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}


