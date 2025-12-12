"use client";

import { useState, useEffect, useLayoutEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ManualEntryModal } from "@/components/admin/ManualEntryModal";
import {
  PlusCircle,
  Coins,
  DollarSign,
  Loader2,
  TrendingUp,
  Inbox,
} from "lucide-react";
import { PageLoadingSpinner } from "@/components/loading/LoadingSpinner";
import { cn } from "@/lib/utils";
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PaginationControls } from "@/components/ui/pagination-controls";

const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();

  let hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'

  const minutesStr = minutes < 10 ? `0${minutes}` : minutes;
  const secondsStr = seconds < 10 ? `0${seconds}` : seconds;

  return `${month}/${day}/${year} ${hours}:${minutesStr}:${secondsStr} ${ampm}`;
};

const formatDateTimeCompact = (dateString: string): string => {
  const date = new Date(dateString);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear().toString().slice(-2);

  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;

  const minutesStr = minutes < 10 ? `0${minutes}` : minutes;

  return `${month}/${day}/${year} ${hours}:${minutesStr} ${ampm}`;
};

interface Transaction {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  userUsername: string | null;
  transactionType: "coins" | "cash";
  amount: number;
  amountFormatted: string;
  category: string | null;
  description: string;
  createdAt: string;
}

const readIsDarkFromDom = () => {
  if (typeof window === "undefined") return false;
  const modeElement = document.querySelector("[data-mode]");
  if (modeElement) {
    return modeElement.getAttribute("data-mode") === "dark";
  }
  const themeElement = document.documentElement;
  return themeElement.getAttribute("data-theme") === "dark";
};

interface Statistics {
  totalCoins: number;
  totalMoneySpent: number; // in cents
  totalTransactions: number;
  totalUniqueUsers: number;
}

export default function ManualEntryPage() {
  const [isDark, setIsDark] = useState<boolean>(readIsDarkFromDom);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [statistics, setStatistics] = useState<Statistics>({
    totalCoins: 0,
    totalMoneySpent: 0,
    totalTransactions: 0,
    totalUniqueUsers: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);

  // Watch for theme changes
  useLayoutEffect(() => {
    const checkTheme = () => {
      const newIsDark = readIsDarkFromDom();
      setIsDark((prev) => (prev === newIsDark ? prev : newIsDark));
    };

    checkTheme();

    const observer = new MutationObserver(checkTheme);
    const targetNode = document.querySelector("[data-mode]");
    if (targetNode) {
      observer.observe(targetNode, {
        attributes: true,
        attributeFilter: ["data-mode"],
      });
    }

    return () => observer.disconnect();
  }, []);

  const fetchTransactions = useCallback(async () => {
    try {
      const offset = (page - 1) * limit;
      const params = new URLSearchParams();
      params.append("limit", limit.toString());
      params.append("offset", offset.toString());
      if (filterType !== "all") {
        params.append("type", filterType);
      }
      if (filterCategory !== "all") {
        params.append("category", filterCategory);
      }

      const queryString = params.toString();
      const url = `/api/admin/manual-entry/history?${queryString}`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        setTransactions(data.transactions || []);
        setTotal(data.total || 0);
        setStatistics(
          data.statistics || {
            totalCoins: 0,
            totalMoneySpent: 0,
            totalTransactions: 0,
            totalUniqueUsers: 0,
          }
        );
      }
    } catch (error) {
      console.error("Error fetching transactions:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [filterType, filterCategory, page, limit]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [filterType, filterCategory]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchTransactions();
  }, [fetchTransactions]);

  const handleSuccess = () => {
    handleRefresh();
  };

  const getCategoryLabel = (category: string | null) => {
    if (!category) return "-";
    return category === "contest_winnings"
      ? "Contest Winnings"
      : "Other Earnings";
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const hasNextPage = page < totalPages;
  const hasPreviousPage = page > 1;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[76vh]">
        <PageLoadingSpinner mode={isDark ? "dark" : "light"} />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8 pb-4 sm:pb-6 lg:pb-8 px-2 sm:px-4 lg:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
        <div>
          <h2
            className={cn(
              "text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight",
              isDark ? "text-white" : "text-gray-900"
            )}
          >
            Manual Entry System
          </h2>
          <p
            className={cn(
              "mt-1 text-xs sm:text-sm lg:text-base",
              isDark ? "text-gray-400" : "text-muted-foreground"
            )}
          >
            Credit coins or cash to any user with transaction notes and proper
            categorization
          </p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-3 sm:gap-4 lg:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {/* Total Coins */}
        <div
          className={cn(
            "rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-3",
            isDark ? "bg-[#170337] text-white" : "bg-white text-black"
          )}
        >
          <div className="flex flex-row items-center justify-between space-y-0 px-3 sm:px-4 lg:px-5 pt-2">
            <div>
              <h1
                className={cn(
                  "text-xs sm:text-sm lg:text-md font-medium",
                  isDark ? "text-white" : "text-gray-900"
                )}
              >
                Total Coins
              </h1>
            </div>
            <div
              className={cn(
                "w-8 h-8 sm:w-9 sm:h-9 lg:w-10 lg:h-10 flex items-center justify-center rounded-full",
                isDark
                  ? "bg-[#FFFFFF36] text-white"
                  : "bg-[#D8C3FF] text-[#4A00BE]"
              )}
            >
              <Coins className="h-4 w-4 sm:h-[18px] sm:w-[18px] lg:h-5 lg:w-5" />
            </div>
          </div>
          <CardContent className="px-3 sm:px-4 lg:px-5 pb-3 sm:pb-4 lg:pb-5">
            <div className="text-lg sm:text-xl lg:text-2xl font-bold">
              {statistics.totalCoins.toLocaleString()}
            </div>
            <p
              className={cn(
                "text-xs sm:text-sm mt-1 sm:mt-2",
                isDark ? "text-gray-300" : "text-gray-600"
              )}
            >
              Total Coins distributed
            </p>
          </CardContent>
        </div>

        {/* Total Money Spent */}
        <div
          className={cn(
            "rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-3",
            isDark ? "bg-[#170337] text-white" : "bg-white text-black"
          )}
        >
          <div className="flex flex-row items-center justify-between space-y-0 px-3 sm:px-4 lg:px-5 pt-2">
            <div>
              <h1
                className={cn(
                  "text-xs sm:text-sm lg:text-md font-medium",
                  isDark ? "text-white" : "text-gray-900"
                )}
              >
                Total Money Spent
              </h1>
            </div>
            <div
              className={cn(
                "w-8 h-8 sm:w-9 sm:h-9 lg:w-10 lg:h-10 flex items-center justify-center rounded-full",
                isDark
                  ? "bg-[#FFFFFF36] text-white"
                  : "bg-[#D8C3FF] text-[#4A00BE]"
              )}
            >
              <DollarSign className="h-4 w-4 sm:h-[18px] sm:w-[18px] lg:h-5 lg:w-5" />
            </div>
          </div>
          <CardContent className="px-3 sm:px-4 lg:px-5 pb-3 sm:pb-4 lg:pb-5">
            <div className="text-lg sm:text-xl lg:text-2xl font-bold">
              {formatCurrencyFromCents(statistics.totalMoneySpent)}
            </div>
            <p
              className={cn(
                "text-xs sm:text-sm mt-1 sm:mt-2",
                isDark ? "text-gray-300" : "text-gray-600"
              )}
            >
              Total Cash distributed
            </p>
          </CardContent>
        </div>

        {/* Total Transactions */}
        <div
          className={cn(
            "rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-3",
            isDark ? "bg-[#170337] text-white" : "bg-white text-black"
          )}
        >
          <div className="flex flex-row items-center justify-between space-y-0 px-3 sm:px-4 lg:px-5 pt-2">
            <div>
              <h1
                className={cn(
                  "text-xs sm:text-sm lg:text-md font-medium",
                  isDark ? "text-white" : "text-gray-900"
                )}
              >
                Total Transactions
              </h1>
            </div>
            <div
              className={cn(
                "w-8 h-8 sm:w-9 sm:h-9 lg:w-10 lg:h-10 flex items-center justify-center rounded-full",
                isDark
                  ? "bg-[#FFFFFF36] text-white"
                  : "bg-[#D8C3FF] text-[#4A00BE]"
              )}
            >
              <TrendingUp className="h-4 w-4 sm:h-[18px] sm:w-[18px] lg:h-5 lg:w-5" />
            </div>
          </div>
          <CardContent className="px-3 sm:px-4 lg:px-5 pb-3 sm:pb-4 lg:pb-5">
            <div className="text-lg sm:text-xl lg:text-2xl font-bold">
              {statistics.totalTransactions.toLocaleString()}
            </div>
            <p
              className={cn(
                "text-xs sm:text-sm mt-1 sm:mt-2",
                isDark ? "text-gray-300" : "text-gray-600"
              )}
            >
              Total transactions processed
            </p>
          </CardContent>
        </div>
      </div>

      {/* Filters and Add Button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 lg:gap-4">
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 lg:gap-4 w-full sm:w-auto">
          <Select
            value={filterType}
            onValueChange={(value) => {
              setFilterType(value);
              if (value !== "cash") {
                setFilterCategory("all");
              }
            }}
          >
            <SelectTrigger
              isDark={isDark}
              className="w-full sm:w-[140px] lg:w-[150px]"
            >
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent isDark={isDark}>
              <SelectItem value="all" isDark={isDark}>
                All Types
              </SelectItem>
              <SelectItem value="coins" isDark={isDark}>
                Coins
              </SelectItem>
              <SelectItem value="cash" isDark={isDark}>
                Cash
              </SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filterCategory}
            onValueChange={(value) => {
              setFilterCategory(value);
              // When category is selected, automatically set type to cash
              // since categories only apply to cash transactions
              if (value !== "all" && filterType !== "cash") {
                setFilterType("cash");
              }
            }}
            disabled={filterType !== "all" && filterType !== "cash"}
          >
            <SelectTrigger
              isDark={isDark}
              className="w-full sm:w-[160px] lg:w-[180px]"
            >
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent isDark={isDark}>
              <SelectItem value="all" isDark={isDark}>
                All Categories
              </SelectItem>
              <SelectItem value="contest_winnings" isDark={isDark}>
                Contest Winnings
              </SelectItem>
              <SelectItem value="other_earnings" isDark={isDark}>
                Other Earnings
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={() => setIsModalOpen(true)}
          className={cn(
            "w-full sm:w-auto text-sm sm:text-base",
            isDark
              ? "bg-[#5F2BB1] hover:bg-[#4A00BE] text-white"
              : "bg-[#4A00BE] hover:bg-[#5F2BB1] text-white"
          )}
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Add Manual Entry</span>
          <span className="sm:hidden">Add Entry</span>
        </Button>
      </div>

      {/* Transactions Table */}
      <Card
        className={cn(
          "overflow-hidden",
          isDark ? "bg-[#170337] border-[#170337]" : "bg-white border-gray-200"
        )}
      >
        {/* <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle
                className={cn(isDark ? "text-white" : "text-gray-900")}
              >
                Manual Entry History
              </CardTitle>
              <CardDescription
                className={cn(isDark ? "text-gray-400" : "text-gray-600")}
              >
                History of all manual entries made by admins
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={cn(
                isDark
                  ? "border-gray-700 text-white hover:bg-[#210B43]"
                  : "border-gray-300"
              )}
            >
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Refresh"
              )}
            </Button>
          </div>
        </CardHeader> */}
        <CardContent className="p-2 sm:p-4 lg:p-6">
          {transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Inbox className="h-12 w-12 mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                No manual entries found. Click "Add Manual Entry" to create one.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-2 sm:-mx-4 lg:-mx-6 px-2 sm:px-4 lg:px-6">
              <Table>
                <TableHeader>
                  <TableRow
                    className={cn(
                      isDark
                        ? "border-gray-700 hover:bg-[#210B43]"
                        : "border-gray-200"
                    )}
                  >
                    <TableHead
                      className={cn(
                        "whitespace-nowrap text-xs sm:text-sm lg:text-base px-2 sm:px-4",
                        isDark ? "text-gray-300" : "text-gray-700"
                      )}
                    >
                      User ID
                    </TableHead>
                    <TableHead
                      className={cn(
                        "whitespace-nowrap text-xs sm:text-sm lg:text-base px-2 sm:px-4",
                        isDark ? "text-gray-300" : "text-gray-700"
                      )}
                    >
                      User
                    </TableHead>
                    <TableHead
                      className={cn(
                        "text-xs sm:text-sm lg:text-base px-2 sm:px-4",
                        isDark ? "text-gray-300" : "text-gray-700"
                      )}
                    >
                      Type
                    </TableHead>
                    <TableHead
                      className={cn(
                        "whitespace-nowrap text-xs sm:text-sm lg:text-base px-2 sm:px-4",
                        isDark ? "text-gray-300" : "text-gray-700"
                      )}
                    >
                      Amount
                    </TableHead>
                    <TableHead
                      className={cn(
                        "whitespace-nowrap text-xs sm:text-sm lg:text-base px-2 sm:px-4 hidden sm:table-cell",
                        isDark ? "text-gray-300" : "text-gray-700"
                      )}
                    >
                      Category
                    </TableHead>
                    <TableHead
                      className={cn(
                        "max-w-[120px] sm:max-w-md break-words whitespace-normal text-xs sm:text-sm lg:text-base px-2 sm:px-4",
                        isDark ? "text-gray-300" : "text-gray-700"
                      )}
                    >
                      Note
                    </TableHead>
                    <TableHead
                      className={cn(
                        "whitespace-nowrap text-xs sm:text-sm lg:text-base px-2 sm:px-4",
                        isDark ? "text-gray-300" : "text-gray-700"
                      )}
                    >
                      Date
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow
                      key={tx.id}
                      className={cn(
                        isDark
                          ? "border-gray-700 hover:bg-[#210B43]"
                          : "border-gray-200"
                      )}
                    >
                      <TableCell
                        className={cn(
                          "whitespace-nowrap text-xs sm:text-sm px-2 sm:px-4",
                          isDark ? "text-gray-300" : "text-gray-900"
                        )}
                      >
                        <div className="text-xs sm:text-sm font-mono break-all">
                          {tx.userId}
                        </div>
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-xs sm:text-sm px-2 sm:px-4",
                          isDark ? "text-gray-300" : "text-gray-900"
                        )}
                      >
                        <div className="space-y-1">
                          <div className="font-medium text-sm sm:text-md">
                            {tx.userName}
                          </div>
                          {tx.userUsername && (
                            <div className="text-sm text-muted-foreground">
                              @{tx.userUsername}
                            </div>
                          )}
                          <div className="text-sm text-muted-foreground break-all">
                            {tx.userEmail}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-xs sm:text-sm px-2 sm:px-4",
                          isDark ? "text-gray-300" : "text-gray-900"
                        )}
                      >
                        <div className="flex items-center gap-1 sm:gap-2">
                          {tx.transactionType === "coins" ? (
                            <Coins className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-500" />
                          ) : (
                            <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
                          )}
                          <span className="capitalize text-xs sm:text-sm">
                            {tx.transactionType}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell
                        className={cn(
                          "font-medium whitespace-nowrap text-xs sm:text-sm px-2 sm:px-4",
                          isDark ? "text-white" : "text-gray-900"
                        )}
                      >
                        {tx.amountFormatted}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "whitespace-nowrap text-xs sm:text-sm px-2 sm:px-4 hidden sm:table-cell",
                          isDark ? "text-gray-300" : "text-gray-900"
                        )}
                      >
                        {tx.transactionType === "cash"
                          ? getCategoryLabel(tx.category)
                          : "-"}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "max-w-[120px] sm:max-w-md break-words whitespace-normal text-xs sm:text-sm px-2 sm:px-4",
                          isDark ? "text-gray-300" : "text-gray-900"
                        )}
                        title={tx.description}
                      >
                        <div className="line-clamp-2 sm:line-clamp-none">
                          {tx.description}
                        </div>
                      </TableCell>
                      <TableCell
                        className={cn(
                          "whitespace-nowrap text-xs sm:text-sm px-2 sm:px-4",
                          isDark ? "text-gray-300" : "text-gray-900"
                        )}
                      >
                        <span className="hidden sm:inline">
                          {formatDateTime(tx.createdAt)}
                        </span>
                        <span className="sm:hidden">
                          {formatDateTimeCompact(tx.createdAt)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {transactions.length > 0 && (
            <div className="mt-3 sm:mt-4 px-2 sm:px-0">
              <PaginationControls
                page={page}
                limit={limit}
                total={total}
                totalPages={totalPages}
                hasNextPage={hasNextPage}
                hasPreviousPage={hasPreviousPage}
                onPageChange={setPage}
                onLimitChange={(newLimit) => {
                  setLimit(newLimit);
                  setPage(1);
                }}
                loading={isRefreshing}
                isDark={isDark}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual Entry Modal */}
      <ManualEntryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
