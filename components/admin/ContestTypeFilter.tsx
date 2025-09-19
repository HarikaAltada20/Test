"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ContestTypeFilterProps {
    value?: "all" | "leaderboard" | "cpm";
    onChange?: (value: string) => void;
}

export default function ContestTypeFilter({ value = "all", onChange: customOnChange }: ContestTypeFilterProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const onChange = (next: string) => {
        if (customOnChange) {
            customOnChange(next);
        } else {
            const params = new URLSearchParams(searchParams?.toString() || "");
            if (next === "all") {
                params.delete("type");
            } else {
                params.set("type", next);
            }
            const qs = params.toString();
            const href = qs ? `/dashboard/admin?${qs}` : "/dashboard/admin";
            router.push(href);
        }
    };

    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="w-44">
                <SelectValue placeholder="Contest Type" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">All Contest Types</SelectItem>
                <SelectItem value="leaderboard">Leaderboard</SelectItem>
                <SelectItem value="cpm">CPM</SelectItem>
            </SelectContent>
        </Select>
    );
}


