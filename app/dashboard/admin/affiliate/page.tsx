"use client";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

export default function AffiliateLandingPage() {
    const [contestId, setContestId] = useState("");
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState<Record<string, boolean>>({});
    const [bulkOpen, setBulkOpen] = useState(false);
    const [bulkRate, setBulkRate] = useState<number>(10);

    const filtered = useMemo(() => rows, [rows]);
    const selectedRows = filtered.filter(r => selected[r.submission_id]);
    const previewTotal = selectedRows.reduce((acc, r) => acc + r.default_commission_cents * (bulkRate / 10), 0);

    const fetchContest = async () => {
        if (!contestId) return;
        try {
            setLoading(true);
            const res = await fetch(`/api/admin/affiliate/${contestId}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to load');
            setRows((json.items || []).map((i: any) => ({
                submission_id: i.submission_id,
                contest_id: i.contest_id,
                winner_username: i.winner_username,
                referrer_username: i.referrer_username,
                winning_amount_cents: i.winning_amount_cents,
                default_commission_cents: i.default_commission_cents,
                status: i.status,
            })));
            setSelected({});
        } catch (e: any) {
            toast.error(e?.message || 'Failed to fetch');
        } finally {
            setLoading(false);
        }
    };

    const toggleAll = (checked: boolean) => {
        const next: Record<string, boolean> = {};
        if (checked) for (const r of filtered) if (r.status === 'pending') next[r.submission_id] = true;
        setSelected(next);
    };

    const creditSelected = async () => {
        if (selectedRows.length === 0) return;
        try {
            setLoading(true);
            // Pull full rows to retrieve user ids for credit
            const resList = await fetch(`/api/admin/affiliate/${contestId}`);
            const jsonList = await resList.json();
            if (!resList.ok) throw new Error(jsonList.error || 'Failed to load list');
            const byId: Record<string, any> = {};
            for (const i of (jsonList.items || [])) byId[i.submission_id] = i;
            const items = selectedRows.map(r => ({
                submission_id: r.submission_id,
                contest_id: r.contest_id,
                winner_user_id: byId[r.submission_id].winner_user_id,
                referrer_user_id: byId[r.submission_id].referrer_user_id,
                winning_amount_cents: r.winning_amount_cents,
            }));
            const res = await fetch(`/api/admin/affiliate/credit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items, default_rate_percent: bulkRate }) });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to credit');
            toast.success('Credited');
            await fetchContest();
            setBulkOpen(false);
        } catch (e: any) {
            toast.error(e?.message || 'Failed to credit');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Affiliate Commissions</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-2 items-center">
                        <Input placeholder="Enter Contest ID" value={contestId} onChange={(e) => setContestId(e.target.value)} />
                        <Button asChild disabled={!contestId}>
                            <Link href={`/dashboard/admin/affiliate/${contestId}`}>Open Contest</Link>
                        </Button>
                        <Button asChild variant="outline">
                            <Link href={`/dashboard/admin/affiliate/earners`}>View Earners</Link>
                        </Button>
                        <Button onClick={fetchContest} disabled={!contestId || loading}>Load</Button>
                    </div>
                    <p className="text-sm text-muted-foreground mt-3">Load a contest to view pending/credited affiliate rows. You can credit in bulk with custom %.</p>
                </CardContent>
            </Card>

            {rows.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Results</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-3 mb-3">
                            <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
                                <DialogTrigger asChild>
                                    <Button disabled={selectedRows.length === 0 || loading}>Credit Selected</Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Bulk Credit</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm">Commission %</span>
                                            <Input type="number" min={0} max={100} value={bulkRate} onChange={(e) => setBulkRate(Number(e.target.value || 0))} />
                                        </div>
                                        <div className="text-sm text-muted-foreground">Selected: {selectedRows.length} • Preview total: ${(previewTotal / 100).toFixed(2)}</div>
                                    </div>
                                    <DialogFooter>
                                        <Button onClick={creditSelected} disabled={loading}>Confirm Credit</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>
                                            <Checkbox
                                                checked={filtered.length > 0 && selectedRows.length === filtered.filter(r => r.status === 'pending').length}
                                                onCheckedChange={(v: any) => toggleAll(Boolean(v))}
                                            />
                                        </TableHead>
                                        <TableHead>Contest</TableHead>
                                        <TableHead>Winner</TableHead>
                                        <TableHead>Referrer</TableHead>
                                        <TableHead>Winnings</TableHead>
                                        <TableHead>Commission (10%)</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtered.map(r => (
                                        <TableRow key={r.submission_id}>
                                            <TableCell>{r.status === 'pending' ? (
                                                <Checkbox checked={!!selected[r.submission_id]} onCheckedChange={(v: any) => setSelected(prev => ({ ...prev, [r.submission_id]: Boolean(v) }))} />
                                            ) : null}</TableCell>
                                            <TableCell>{r.contest_id.slice(0, 8)}…</TableCell>
                                            <TableCell>@{r.winner_username || '-'}</TableCell>
                                            <TableCell>@{r.referrer_username || '-'}</TableCell>
                                            <TableCell>${(r.winning_amount_cents / 100).toFixed(2)}</TableCell>
                                            <TableCell>${(r.default_commission_cents / 100).toFixed(2)}</TableCell>
                                            <TableCell>{r.status}</TableCell>
                                        </TableRow>))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}


