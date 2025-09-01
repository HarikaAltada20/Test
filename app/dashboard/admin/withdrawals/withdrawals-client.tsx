"use client";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Request = {
    id: string;
    created_at: string;
    amount: number;
    currency: string;
    amount_type: "cash" | "coins";
    status: string;
    user_id: string;
    user_notes?: string | null;
    admin_notes?: string | null;
    processed_at?: string | null;
    transaction_reference?: string | null;
    payout_method_type_snapshot?: string | null;
    payout_method_details_snapshot?: any | null;
    users?: { full_name?: string | null; email?: string | null } | null;
};

export default function WithdrawalsClient({ initialRequests }: { initialRequests: Request[] }) {
    const [requests, setRequests] = useState<Request[]>(initialRequests || []);
    const [detailsOpen, setDetailsOpen] = useState<boolean>(false);
    const [active, setActive] = useState<Request | null>(null);
    const [adminNotes, setAdminNotes] = useState<string>("");
    const [txRef, setTxRef] = useState<string>("");
    const [updating, setUpdating] = useState<boolean>(false);

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

    const updateStatus = async (id: string, newStatus: string, extras?: { transaction_reference?: string; admin_notes?: string }) => {
        try {
            setUpdating(true);
            const res = await fetch(`/api/admin/withdrawals/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus, ...(extras || {}) }),
            });
            if (!res.ok) throw new Error(await res.text());
            setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: newStatus, transaction_reference: extras?.transaction_reference ?? r.transaction_reference, admin_notes: extras?.admin_notes ?? r.admin_notes, processed_at: newStatus === "processed" ? new Date().toISOString() : r.processed_at } : r)));
        } catch (e) {
            console.error("Failed to update status", e);
            alert("Failed to update status");
        } finally {
            setUpdating(false);
        }
    };

    const cancelRequest = async (req: Request) => {
        if (!confirm("Cancel this withdrawal and refund the user's balance?")) return;
        try {
            setUpdating(true);
            const res = await fetch(`/api/admin/withdrawals/${req.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "cancel", user_id: req.user_id })
            });
            if (!res.ok) throw new Error(await res.text());
            setRequests((prev) => prev.map((r) => (r.id === req.id ? { ...r, status: "cancelled" } as Request : r)));
            setDetailsOpen(false);
        } catch (e) {
            console.error("Failed to cancel request", e);
            alert("Failed to cancel request");
        } finally {
            setUpdating(false);
        }
    };

    const openDetails = (req: Request) => {
        setActive(req);
        setAdminNotes(req.admin_notes || "");
        setTxRef(req.transaction_reference || "");
        setDetailsOpen(true);
    };

    const formatPayoutSummary = (r: Request) => {
        const type = (r.payout_method_type_snapshot || "").toLowerCase();
        const d: any = r.payout_method_details_snapshot || {};
        if (type === "upi") return `UPI: ${d?.upi_id || ""} (${d?.account_holder_name || ""})`;
        if (type === "crypto") return `${(d?.network || "").toUpperCase()} Wallet: ${d?.wallet_address || ""}`;
        if (type === "bank_transfer") return `Bank • ${d?.account_holder_name || ""} • ****${String(d?.account_number || "").slice(-4)} • ${d?.ifsc_code || d?.swift_bic_code || ""}`;
        return type ? `${type}: ${JSON.stringify(d)}` : "Unknown method";
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
                        <th className="py-2 pr-4">Pay To</th>
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
                            <td className="py-2 pr-4">{formatPayoutSummary(r)}</td>
                            <td className="py-2 pr-4 space-x-2">
                                <Button size="sm" variant="outline" onClick={() => openDetails(r)}>View</Button>
                                <Button size="sm" variant="outline" onClick={() => updateStatus(r.id, "in_review")} disabled={updating}>Mark In Review</Button>
                                <Button size="sm" variant="outline" onClick={() => updateStatus(r.id, "approved")} disabled={updating}>Approve</Button>
                                <Button size="sm" onClick={() => updateStatus(r.id, "processed")} disabled={updating}>Mark Paid</Button>
                                <Button size="sm" variant="outline" onClick={() => updateStatus(r.id, "rejected")} disabled={updating}>Reject</Button>
                                <Button size="sm" variant="outline" onClick={() => updateStatus(r.id, "failed")} disabled={updating}>Fail</Button>
                                <Button size="sm" variant="outline" onClick={() => cancelRequest(r)} disabled={updating}>Cancel</Button>
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

            {/* Details / Pay Instruction Modal */}
            <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
                <DialogContent className="sm:max-w-[650px]">
                    <DialogHeader>
                        <DialogTitle>Withdrawal Details</DialogTitle>
                        <DialogDescription>Use this information to pay the creator and update status.</DialogDescription>
                    </DialogHeader>
                    {active && (
                        <div className="space-y-4 py-2">
                            <div className="text-sm">
                                <div><b>Created:</b> {new Date(active.created_at).toLocaleString()}</div>
                                <div><b>User:</b> {active.users?.full_name || "-"} ({active.users?.email || "-"})</div>
                                <div><b>Amount:</b> {active.amount_type === "cash" ? formatCurrencyFromCents(active.amount) : `${active.amount} coins`}</div>
                                <div><b>Status:</b> {active.status}</div>
                                <div><b>Pay To:</b> {formatPayoutSummary(active)}</div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="admin_notes">Admin Notes</Label>
                                    <Input id="admin_notes" value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} placeholder="Notes for audit trail" />
                                </div>
                                <div>
                                    <Label htmlFor="tx_ref">Transaction Reference</Label>
                                    <Input id="tx_ref" value={txRef} onChange={(e) => setTxRef(e.target.value)} placeholder="UTR / TXID / Ref#" />
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter className="justify-between">
                        <div className="space-x-2">
                            {active && (
                                <>
                                    <Button variant="outline" onClick={() => cancelRequest(active!)} disabled={updating}>Cancel Request</Button>
                                    <Button variant="outline" onClick={() => updateStatus(active!.id, "approved", { admin_notes: adminNotes })} disabled={updating}>Approve</Button>
                                </>
                            )}
                        </div>
                        <div className="space-x-2">
                            {active && (
                                <>
                                    <Button variant="outline" onClick={() => updateStatus(active!.id, "in_review", { admin_notes: adminNotes })} disabled={updating}>Mark In Review</Button>
                                    <Button onClick={() => updateStatus(active!.id, "processed", { transaction_reference: txRef, admin_notes: adminNotes })} disabled={updating}>Mark Paid</Button>
                                </>
                            )}
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}


