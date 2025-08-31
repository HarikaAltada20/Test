"use client";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { formatCurrencyFromCents } from "@/lib/currency-utils";

type Request = {
    id: string;
    created_at: string;
    amount: number;
    currency: string;
    amount_type: "cash" | "coins";
    status: string;
    user_notes?: string | null;
    admin_notes?: string | null;
    processed_at?: string | null;
    transaction_reference?: string | null;
    users?: { full_name?: string | null; email?: string | null } | null;
};

export default function WithdrawalsClient({ initialRequests }: { initialRequests: Request[] }) {
    const [requests, setRequests] = useState<Request[]>(initialRequests || []);

    const totals = useMemo(() => {
        const all = requests.reduce((sum, r) => sum + (r.amount_type === "cash" ? r.amount : 0), 0);
        const pending = requests
            .filter((r) => r.status === "pending" || r.status === "in_review")
            .reduce((s, r) => s + (r.amount_type === "cash" ? r.amount : 0), 0);
        const paid = requests
            .filter((r) => r.status === "processed" || r.status === "approved")
            .reduce((s, r) => s + (r.amount_type === "cash" ? r.amount : 0), 0);
        return { all, pending, paid };
    }, [requests]);

    const updateStatus = async (id: string, newStatus: string) => {
        try {
            const res = await fetch(`/api/admin/withdrawals/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            });
            if (!res.ok) throw new Error(await res.text());
            setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r)));
        } catch (e) {
            console.error("Failed to update status", e);
            alert("Failed to update status");
        }
    };

    const renderTable = (rows: Request[]) => (
        <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
                <thead>
                    <tr className="text-left border-b">
                        <th className="py-2 pr-4">Created</th>
                        <th className="py-2 pr-4">User</th>
                        <th className="py-2 pr-4">Amount</th>
                        <th className="py-2 pr-4">Type</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 pr-4">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r) => (
                        <tr key={r.id} className="border-b">
                            <td className="py-2 pr-4">{new Date(r.created_at).toLocaleString()}</td>
                            <td className="py-2 pr-4">{r.users?.full_name || "-"} ({r.users?.email || "-"})</td>
                            <td className="py-2 pr-4">{r.amount_type === "cash" ? formatCurrencyFromCents(r.amount) : `${r.amount} coins`}</td>
                            <td className="py-2 pr-4">{r.amount_type}</td>
                            <td className="py-2 pr-4 capitalize">{r.status.replace("_", " ")}</td>
                            <td className="py-2 pr-4 space-x-2">
                                <Button size="sm" variant="outline" onClick={() => updateStatus(r.id, "in_review")}>Mark In Review</Button>
                                <Button size="sm" onClick={() => updateStatus(r.id, "processed")}>Mark Paid</Button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const allRows = requests;
    const pendingRows = requests.filter((r) => r.status === "pending" || r.status === "in_review");
    const paidRows = requests.filter((r) => r.status === "processed" || r.status === "approved");

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader>
                        <CardTitle>Total</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrencyFromCents(totals.all)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Pending</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrencyFromCents(totals.pending)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Paid</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrencyFromCents(totals.paid)}</div>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="all">
                <TabsList>
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="pending">Pending</TabsTrigger>
                    <TabsTrigger value="paid">Paid</TabsTrigger>
                </TabsList>
                <TabsContent value="all">{renderTable(allRows)}</TabsContent>
                <TabsContent value="pending">{renderTable(pendingRows)}</TabsContent>
                <TabsContent value="paid">{renderTable(paidRows)}</TabsContent>
            </Tabs>
        </div>
    );
}


