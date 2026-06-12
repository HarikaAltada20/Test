"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Filter, Plus, Search, SlidersHorizontal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type RecipientRow = {
  index: number;
  email: string;
  fullName: string;
  username: string;
  status: string;
  fromEmail: string | null;
};

type Props = {
  campaignId: string;
};

export function LeadTab({ campaignId }: Props) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [recipients, setRecipients] = useState<RecipientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: "1" });
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (search.trim()) params.set("search", search.trim());

    fetch(`/api/admin/email-campaigns/${campaignId}/recipients?${params}`)
      .then((r) => r.json())
      .then((d) => setRecipients(d.recipients ?? []))
      .finally(() => setLoading(false));
  }, [campaignId, statusFilter, search]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return recipients;
    return recipients.filter(
      (r) =>
        r.email.toLowerCase().includes(q) ||
        r.fullName.toLowerCase().includes(q) ||
        r.username.toLowerCase().includes(q),
    );
  }, [recipients, search]);

  const toggleAll = (checked: boolean) => {
    if (checked) setSelected(new Set(filtered.map((r) => r.index)));
    else setSelected(new Set());
  };

  const contactLabel = (r: RecipientRow) =>
    r.fullName || r.username || "—";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search emails, contacts, companies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-11 bg-white border-gray-300"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-11 bg-white border-gray-300">
            <Filter className="h-4 w-4 mr-2 shrink-0" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Filter: All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="opened">Opened</SelectItem>
            <SelectItem value="clicked">Clicked</SelectItem>
            <SelectItem value="bounced">Bounced</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" className="h-11 border-gray-300">
          <SlidersHorizontal className="h-4 w-4 mr-2" />
          Manage Table
        </Button>

        <Button
          className="h-11 bg-[#662EBD] hover:bg-[#5524a8]"
          onClick={() =>
            toast({
              title: "Add leads",
              description:
                "Select users on the Table tab and use Send email to attach recipients to this campaign.",
            })
          }
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Leads
        </Button>
      </div>

      <Card className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50/80 text-muted-foreground">
                <th className="p-4 w-10">
                  <Checkbox
                    checked={
                      filtered.length > 0 &&
                      filtered.every((r) => selected.has(r.index))
                    }
                    onCheckedChange={(v) => toggleAll(!!v)}
                  />
                </th>
                <th className="p-4 text-left font-medium w-12">#</th>
                <th className="p-4 text-left font-medium">Email</th>
                <th className="p-4 text-left font-medium">Status</th>
                <th className="p-4 text-left font-medium">From Email</th>
                <th className="p-4 text-left font-medium">Contact</th>
                <th className="p-4 text-left font-medium">Company</th>
                <th className="p-4 text-left font-medium">Website</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-muted-foreground">
                    Loading leads...
                  </td>
                </tr>
              )}
              {!loading &&
                filtered.map((r) => (
                  <tr key={r.index} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="p-4">
                      <Checkbox
                        checked={selected.has(r.index)}
                        onCheckedChange={(v) => {
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (v) next.add(r.index);
                            else next.delete(r.index);
                            return next;
                          });
                        }}
                      />
                    </td>
                    <td className="p-4 text-muted-foreground">{r.index}</td>
                    <td className="p-4 font-medium">{r.email || "—"}</td>
                    <td className="p-4 capitalize text-muted-foreground">
                      {r.status || "—"}
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {r.fromEmail || "—"}
                    </td>
                    <td className="p-4">{contactLabel(r)}</td>
                    <td className="p-4 text-muted-foreground">—</td>
                    <td className="p-4 text-muted-foreground">—</td>
                  </tr>
                ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-muted-foreground">
                    No leads attached yet. Use Add Leads or send from the Users table.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
