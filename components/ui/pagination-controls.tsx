import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

interface PaginationControlsProps {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  loading?: boolean;
  // When true, hide the 200 items per-page option (useful for specific pages like leaderboard)
  hide200Option?: boolean;
  isDark?: boolean;
  // Optional visibility controls (default to true)
  showResultInfo?: boolean;
  showPageSizeSelector?: boolean;
  showEdgeButtons?: boolean; // first/last buttons
  showPrevNextButtons?: boolean; // previous/next buttons
  // Custom page size options (defaults to [25, 50, 100, 200])
  pageSizeOptions?: number[];
}

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

export function PaginationControls({
  page,
  limit,
  total,
  totalPages,
  hasNextPage,
  hasPreviousPage,
  onPageChange,
  onLimitChange,
  loading = false,
  hide200Option = false,
  isDark = false,
  showResultInfo = true,
  showPageSizeSelector = true,
  showEdgeButtons = true,
  showPrevNextButtons = true,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
}: PaginationControlsProps) {
  const startItem = Math.min((page - 1) * limit + 1, total);
  const endItem = Math.min(page * limit, total);

  // Track window size for responsive pagination
  const [windowWidth, setWindowWidth] = useState<number>(
    typeof window !== "undefined" ? window.innerWidth : 1024
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);
    handleResize(); // Set initial value

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handlePageSizeChange = (value: string) => {
    const newLimit = parseInt(value, 10);
    onLimitChange(newLimit);
    // Reset to page 1 when changing page size
    onPageChange(1);
  };

  // Generate page numbers to display (responsive based on screen size)
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    // Show same number of pages on all screen sizes for consistency
    const maxVisiblePages = 7;

    if (totalPages <= maxVisiblePages) {
      // Show all pages if total pages fit within max visible
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
      return pages;
    }

    // Strategy: Build pages array and ensure it doesn't exceed maxVisiblePages
    // Always show: first page, current page area, last page
    // Add ellipses only if there are gaps AND we have room

    let adjustedStart: number;
    let adjustedEnd: number;

    // Start with maximum possible middle pages (assuming no ellipses)
    let middlePageSlots = maxVisiblePages - 2; // Reserve for first and last

    // Try to determine what we want to show
    if (page <= middlePageSlots + 1) {
      // Near beginning: show consecutive from start
      adjustedStart = 2;
      adjustedEnd = Math.min(totalPages - 1, middlePageSlots + 1);
    } else if (page >= totalPages - middlePageSlots + 1) {
      // Near end: show consecutive to end
      adjustedEnd = totalPages - 1;
      adjustedStart = Math.max(2, totalPages - middlePageSlots + 1);
    } else {
      // In middle: show around current page
      const sideCount = Math.floor((middlePageSlots - 1) / 2);
      adjustedStart = Math.max(2, page - sideCount);
      adjustedEnd = Math.min(totalPages - 1, page + sideCount);
    }

    // Now check if we need ellipses and if we have room
    const needsEllipsisBefore = adjustedStart > 2;
    const needsEllipsisAfter = adjustedEnd < totalPages - 1;
    const ellipsisCount =
      (needsEllipsisBefore ? 1 : 0) + (needsEllipsisAfter ? 1 : 0);

    // Recalculate middle slots accounting for ellipses
    middlePageSlots = Math.max(1, maxVisiblePages - 2 - ellipsisCount);

    // Adjust if we exceeded the limit
    const currentMiddleCount = adjustedEnd - adjustedStart + 1;
    if (currentMiddleCount > middlePageSlots) {
      // Reduce middle pages to fit
      if (page <= middlePageSlots + 1) {
        adjustedStart = 2;
        adjustedEnd = Math.min(totalPages - 1, middlePageSlots + 1);
      } else if (page >= totalPages - middlePageSlots + 1) {
        adjustedEnd = totalPages - 1;
        adjustedStart = Math.max(2, totalPages - middlePageSlots + 1);
      } else {
        const sideCount = Math.floor((middlePageSlots - 1) / 2);
        adjustedStart = Math.max(2, page - sideCount);
        adjustedEnd = Math.min(totalPages - 1, page + sideCount);
      }
    }

    // Ensure valid range
    adjustedStart = Math.max(2, adjustedStart);
    adjustedEnd = Math.max(
      adjustedStart,
      Math.min(totalPages - 1, adjustedEnd)
    );

    // Update ellipsis flags based on final values
    let showEllipsisBefore = adjustedStart > 2;
    let showEllipsisAfter = adjustedEnd < totalPages - 1;

    // Verify total count doesn't exceed maxVisiblePages
    // Total = 1 (first) + ellipsisBefore + middlePages + ellipsisAfter + 1 (last)
    const totalCount =
      2 +
      (showEllipsisBefore ? 1 : 0) +
      (adjustedEnd - adjustedStart + 1) +
      (showEllipsisAfter ? 1 : 0);

    if (totalCount > maxVisiblePages) {
      // Remove ellipses if we don't have room, prioritizing showing pages
      if (showEllipsisBefore && showEllipsisAfter) {
        // Can't show both ellipses, remove one
        // Prefer to keep ellipsis that's further from current page
        if (page - adjustedStart < adjustedEnd - page) {
          showEllipsisBefore = false;
        } else {
          showEllipsisAfter = false;
        }
      }

      // Recheck and remove remaining ellipsis if still over limit
      const newTotalCount =
        2 +
        (showEllipsisBefore ? 1 : 0) +
        (adjustedEnd - adjustedStart + 1) +
        (showEllipsisAfter ? 1 : 0);
      if (newTotalCount > maxVisiblePages) {
        // Remove remaining ellipsis
        showEllipsisBefore = false;
        showEllipsisAfter = false;
      }
    }

    // Build the pages array
    pages.push(1);

    if (showEllipsisBefore) {
      pages.push("...");
    }

    for (let i = adjustedStart; i <= adjustedEnd; i++) {
      pages.push(i);
    }

    if (showEllipsisAfter) {
      pages.push("...");
    }

    pages.push(totalPages);

    return pages;
  };

  return (
    <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Results info and page size selector */}
      {(showResultInfo || showPageSizeSelector) && (
        <div className="flex flex-row items-center gap-2 sm:gap-4 flex-wrap">
          {showResultInfo && (
            <div
              className={cn(
                "text-xs sm:text-sm text-muted-foreground whitespace-nowrap",
                isDark && "text-slate-300"
              )}
            >
              Showing {total > 0 ? startItem : 0} to {endItem} of {total}{" "}
              results
            </div>
          )}

          {showPageSizeSelector && (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span
                className={cn(
                  "text-xs sm:text-sm text-muted-foreground whitespace-nowrap",
                  isDark && "text-slate-300"
                )}
              >
                Show:
              </span>
              <Select
                value={limit.toString()}
                onValueChange={handlePageSizeChange}
                disabled={loading}
              >
                <SelectTrigger
                  className={cn(
                    "w-16 sm:w-20 h-8 text-xs sm:text-sm",
                    isDark && "border border-gray-600"
                  )}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent
                  isDark={isDark}
                  className={cn(
                    isDark && "border-gray-600 bg-[#07031D] text-white"
                  )}
                >
                  {(hide200Option
                    ? pageSizeOptions.filter((size) => size !== 200)
                    : pageSizeOptions
                  ).map((size) => (
                    <SelectItem
                      isDark={isDark}
                      key={size}
                      value={size.toString()}
                      className={cn(
                        isDark &&
                          "bg-[#07031D] text-white focus:bg-slate-800 data-[state=checked]:bg-slate-700"
                      )}
                    >
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span
                className={cn(
                  "text-xs sm:text-sm text-muted-foreground whitespace-nowrap hidden sm:inline",
                  isDark && "text-slate-300"
                )}
              >
                per page
              </span>
            </div>
          )}
        </div>
      )}

      {/* Page navigation */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center sm:justify-start gap-0.5 sm:gap-1 flex-wrap">
          {/* First page - hidden on mobile */}
          {showEdgeButtons && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(1)}
              disabled={!hasPreviousPage || loading}
              className={cn(
                "h-8 w-8 p-0 hidden sm:flex",
                isDark &&
                  "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 disabled:border-slate-800 disabled:bg-slate-900"
              )}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
          )}

          {/* Previous page */}
          {showPrevNextButtons && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={!hasPreviousPage || loading}
              className={cn(
                "h-8 w-8 p-0 sm:w-8",
                isDark &&
                  "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 disabled:border-slate-800 disabled:bg-slate-900"
              )}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}

          {/* Page numbers */}
          <div className="flex items-center gap-0.5 sm:gap-1 overflow-x-auto scrollbar-hide">
            {getPageNumbers().map((pageNum, index) => (
              <React.Fragment key={index}>
                {pageNum === "..." ? (
                  <span
                    className={cn(
                      "px-1 sm:px-2 text-xs sm:text-sm text-muted-foreground whitespace-nowrap",
                      isDark && "text-slate-400"
                    )}
                  >
                    ...
                  </span>
                ) : (
                  <Button
                    variant={pageNum === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => onPageChange(pageNum as number)}
                    disabled={loading}
                    className={cn(
                      "h-8 min-w-8 px-2 sm:w-8 sm:p-0 text-xs sm:text-sm",
                      isDark &&
                        (pageNum === page
                          ? "border-slate-700 bg-[#7F39EC] text-slate-100 hover:bg-slate-700"
                          : "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800")
                    )}
                  >
                    {pageNum}
                  </Button>
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Next page */}
          {showPrevNextButtons && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={!hasNextPage || loading}
              className={cn(
                "h-8 w-8 p-0",
                isDark &&
                  "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 disabled:border-slate-800 disabled:bg-slate-900"
              )}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}

          {/* Last page - hidden on mobile */}
          {showEdgeButtons && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(totalPages)}
              disabled={!hasNextPage || loading}
              className={cn(
                "h-8 w-8 p-0 hidden sm:flex",
                isDark &&
                  "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 disabled:border-slate-800 disabled:bg-slate-900"
              )}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
