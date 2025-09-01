"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

type Item = {
    submission_id: string;
    contest_id: string;
    winner_user_id: string;
    winner_username: string | null;
    referrer_user_id: string;
    referrer_username: string | null;
    winning_amount_cents: number;
    default_rate_percent: number;
    default_commission_cents: number;
    status: 'pending' | 'credited';
};

export default function ContestAffiliatePage() {
    const params = useParams<{ contestId: string }>();
    const contestId = params?.contestId as string;
    const [items, setItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [selected, setSelected] = useState<Record<string, boolean>>({});
    const [bulkOpen, setBulkOpen] = useState(false);
    const [bulkRate, setBulkRate] = useState<number>(10);
    const [creditType, setCreditType] = useState<'wallet' | 'external'>('wallet');

    const totals = useMemo(() => {
        const pending = items.filter(i => i.status === 'pending');
        const credited = items.filter(i => i.status === 'credited');
        return {
            rows: items.length,
            pending: pending.length,
            credited: credited.length,
            totalCommissionCents: items.reduce((acc, i) => acc + i.default_commission_cents, 0),
            pendingCommissionCents: pending.reduce((acc, i) => acc + i.default_commission_cents, 0),
            paidCommissionCents: credited.reduce((acc, i) => acc + i.default_commission_cents, 0)
        };
    }, [items]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const res = await fetch(`/api/admin/affiliate/${contestId}`);
                const json = await res.json();
                if (!res.ok) throw new Error(json.error || 'Failed to load');
                setItems(json.items || []);
            } catch (e: any) {
                toast.error(e?.message || 'Failed to fetch affiliates');
            } finally {
                setLoading(false);
            }
        };
        if (contestId) fetchData();
    }, [contestId]);

    const toggleAll = (checked: boolean) => {
        const next: Record<string, boolean> = {};
        if (checked) {
            for (const i of items) {
                if (i.status === 'pending') next[i.submission_id] = true;
            }
        }
        setSelected(next);
    };

    const selectedItems = items.filter(i => selected[i.submission_id]);

    const creditSelected = async () => {
        if (selectedItems.length === 0) return;
        try {
            setLoading(true);
            const payload = {
                items: selectedItems.map(i => ({
                    submission_id: i.submission_id,
                    contest_id: i.contest_id,
                    winner_user_id: i.winner_user_id,
                    referrer_user_id: i.referrer_user_id,
                    winning_amount_cents: i.winning_amount_cents,
                })),
                default_rate_percent: bulkRate,
                credit_type: creditType,
            };
            const res = await fetch(`/api/admin/affiliate/credit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to credit');

            // Refresh
            toast.success(`Affiliate commissions ${creditType === 'wallet' ? 'credited to wallet' : 'marked as paid externally'}`);
            setSelected({});
            const reload = await fetch(`/api/admin/affiliate/${contestId}`);
            const rjson = await reload.json();
            setItems(rjson.items || []);
            setBulkOpen(false);
        } catch (e: any) {
            toast.error(e?.message || 'Failed to credit affiliates');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Contest Affiliate Earnings</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-4 items-center">
                        <div>Rows: {totals.rows}</div>
                        <div>Pending: {totals.pending}</div>
                        <div>Credited: {totals.credited}</div>
                        <div>Total Pending: ${(totals.totalCommissionCents / 100).toFixed(2)}</div>
                        <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
                            <DialogTrigger asChild>
                                <Button disabled={loading || selectedItems.length === 0}>Credit Selected</Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Credit Affiliate Commissions</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-3">
                                    <div className="text-sm text-muted-foreground">Selected: {selectedItems.length}</div>
                                    <div className="flex items-center gap-2">
                                        <label className="text-sm">Commission %</label>
                                        <Input type="number" min={0} max={100} value={bulkRate} onChange={(e) => setBulkRate(Number(e.target.value || 0))} />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label className="text-sm">Payment Method</label>
                                        <select value={creditType} onChange={(e) => setCreditType(e.target.value as 'wallet' | 'external')} className="text-sm">
                                            <option value="wallet">Wallet</option>
                                            <option value="external">External</option>
                                        </select>
                                    </div>

                                    {creditType === 'wallet' && (
                                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                            <div className="text-sm font-medium text-blue-700">Transaction Preview</div>
                                            <div className="text-xs text-blue-600 mt-1">
                                                {selectedItems.length > 0 && (
                                                    <>
                                                        {Object.entries(
                                                            selectedItems.reduce((acc, item) => {
                                                                const referrer = item.referrer_username || item.referrer_user_id.slice(0, 6);
                                                                if (!acc[referrer]) acc[referrer] = 0;
                                                                // Calculate commission based on winning amount and selected rate
                                                                acc[referrer] += Math.round((item.winning_amount_cents * bulkRate) / 100);
                                                                return acc;
                                                            }, {} as Record<string, number>)
                                                        ).map(([referrer, amount]) => (
                                                            <div key={referrer}>
                                                                @{referrer}: ${(amount / 100).toFixed(2)}
                                                            </div>
                                                        ))}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <DialogFooter>
                                    <Button onClick={creditSelected} disabled={loading}>
                                        {creditType === 'wallet' ? 'Confirm Credit' : 'Mark as Paid'}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>
                                        <Checkbox
                                            checked={items.length > 0 && selectedItems.length === items.filter(i => i.status === 'pending').length}
                                            onCheckedChange={(v: any) => toggleAll(Boolean(v))}
                                        />
                                    </TableHead>
                                    <TableHead>Winner</TableHead>
                                    <TableHead>Referrer</TableHead>
                                    <TableHead>Winnings</TableHead>
                                    <TableHead>Commission (10%)</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.map((i) => (
                                    <TableRow key={i.submission_id} className={i.status === 'credited' ? 'opacity-60' : ''}>
                                        <TableCell>
                                            {i.status === 'pending' ? (
                                                <Checkbox checked={!!selected[i.submission_id]} onCheckedChange={(v: any) => setSelected(prev => ({ ...prev, [i.submission_id]: Boolean(v) }))} />
                                            ) : null}
                                        </TableCell>
                                        <TableCell>@{i.winner_username || i.winner_user_id.slice(0, 6)}</TableCell>
                                        <TableCell>@{i.referrer_username || i.referrer_user_id.slice(0, 6)}</TableCell>
                                        <TableCell>${(i.winning_amount_cents / 100).toFixed(2)}</TableCell>
                                        <TableCell>${(i.default_commission_cents / 100).toFixed(2)}</TableCell>
                                        <TableCell>{i.status}</TableCell>
                                    </TableRow>
                                ))}
                                {items.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">No affiliate earnings found for this contest.</TableCell>
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


