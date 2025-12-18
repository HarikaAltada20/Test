"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { cn } from "@/lib/utils";

type Tx = {
  id: string;
  type: string;
  status: string;
  amount: number;
  description?: string | null;
  remarks?: string | null;
  created_at: string;
};

export default function AffiliateTransactionsPage() {
  const params = useParams<{ userId: string }>();
  const userId = params?.userId as string;
  const [items, setItems] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(false);
   // Get theme from parent layout instead of managing independent state
   const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      // Check data-mode attribute from parent layout
      const modeElement = document.querySelector("[data-mode]");
      if (modeElement) {
        const dataMode = modeElement.getAttribute("data-mode");
        return dataMode === "dark";
      }
      // Fallback to data-theme attribute
      const themeElement = document.documentElement;
      const dataTheme = themeElement.getAttribute("data-theme");
      return dataTheme === "dark";
    }
    return false; // Default to light mode
  });

  
    // Watch for theme changes from parent layout
    useEffect(() => {
      const checkTheme = () => {
        const modeElement = document.querySelector("[data-mode]");
        if (modeElement) {
          const currentMode = modeElement.getAttribute("data-mode");
          const newIsDark = currentMode === "dark";
          if (newIsDark !== isDark) {
            setIsDark(newIsDark);
          }
        }
      };
  
      checkTheme();
  
      // Watch for changes in the data attribute
      const observer = new MutationObserver(checkTheme);
      const targetNode = document.querySelector("[data-mode]");
      if (targetNode) {
        observer.observe(targetNode, {
          attributes: true,
          attributeFilter: ["data-mode"],
        });
      }
  
      return () => observer.disconnect();
    }, [isDark]);

    
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

  useEffect(() => {
    if (userId) load();
  }, [userId]);

  return (
    <div className="space-y-6">
      <Card
        className={cn(
          "shadow-md hover:shadow-lg transition-shadow duration-200",
          isDark ? "bg-[#170337]" : "bg-white border-gray-200"
        )}
      >
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
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-sm text-muted-foreground py-8"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <svg
                          className="animate-spin h-5 w-5 text-muted-foreground"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        <span>Loading affiliate transactions...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-sm text-muted-foreground"
                    >
                      No affiliate transactions found.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>
                        {new Date(tx.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>${(tx.amount / 100).toFixed(2)}</TableCell>
                      <TableCell>{tx.status}</TableCell>
                      <TableCell>{tx.description || "-"}</TableCell>
                      <TableCell>{tx.remarks || "-"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
