import React from "react";
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
}: PaginationControlsProps) {
  const startItem = Math.min((page - 1) * limit + 1, total);
  const endItem = Math.min(page * limit, total);

  const handlePageSizeChange = (value: string) => {
    const newLimit = parseInt(value, 10);
    onLimitChange(newLimit);
    // Reset to page 1 when changing page size
    onPageChange(1);
  };

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisiblePages = 7;

    if (totalPages <= maxVisiblePages) {
      // Show all pages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show pages with ellipsis
      if (page <= 4) {
        // Near the beginning
        for (let i = 1; i <= 5; i++) {
          pages.push(i);
        }
        pages.push("...");
        pages.push(totalPages);
      } else if (page >= totalPages - 3) {
        // Near the end
        pages.push(1);
        pages.push("...");
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        // In the middle
        pages.push(1);
        pages.push("...");
        for (let i = page - 1; i <= page + 1; i++) {
          pages.push(i);
        }
        pages.push("...");
        pages.push(totalPages);
      }
    }

    return pages;
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Results info and page size selector */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <div
          className={cn(
            "text-sm text-muted-foreground",
            isDark && "text-slate-300"
          )}
        >
          Showing {total > 0 ? startItem : 0} to {endItem} of {total} results
        </div>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-sm text-muted-foreground",
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
                "w-20",
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
                ? PAGE_SIZE_OPTIONS.filter((size) => size !== 200)
                : PAGE_SIZE_OPTIONS
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
              "text-sm text-muted-foreground",
              isDark && "text-slate-300"
            )}
          >
            per page
          </span>
        </div>
      </div>

      {/* Page navigation */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          {/* First page */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(1)}
            disabled={!hasPreviousPage || loading}
            className={cn(
              "h-8 w-8 p-0",
              isDark &&
                "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 disabled:border-slate-800 disabled:bg-slate-900"
            )}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>

          {/* Previous page */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={!hasPreviousPage || loading}
            className={cn(
              "h-8 w-8 p-0",
              isDark &&
                "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 disabled:border-slate-800 disabled:bg-slate-900"
            )}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {/* Page numbers */}
          <div className="flex items-center gap-1">
            {getPageNumbers().map((pageNum, index) => (
              <React.Fragment key={index}>
                {pageNum === "..." ? (
                  <span
                    className={cn(
                      "px-2 text-sm text-muted-foreground",
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
                      "h-8 w-8 p-0",
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

          {/* Last page */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(totalPages)}
            disabled={!hasNextPage || loading}
            className={cn(
              "h-8 w-8 p-0",
              isDark &&
                "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 disabled:border-slate-800 disabled:bg-slate-900"
            )}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
