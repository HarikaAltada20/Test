"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Loader2, Search, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  USER_SEARCH_SCOPES,
  USER_SEARCH_MAX_LENGTH,
  detectScopeShortcut,
  minQueryLength,
  normalizeSearchTerm,
  type UserSearchScope,
  type UserSearchType,
} from "@/lib/admin-user-search";
import { UserAvatar } from "./UserAvatar";
import { UserTypeBadge } from "./UserTypeBadge";
import { type AdminSearchUser, userDisplayName } from "./types";

const TYPE_FILTERS: { value: UserSearchType; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "creator", label: "Creators" },
  { value: "advertiser", label: "Brands" },
];

const MATCH_LABEL: Record<string, string> = {
  id: "user ID",
  username: "username",
  email: "email",
  name: "name",
};

function Highlight({ text, term }: { text: string; term: string }) {
  if (!term) return <>{text}</>;
  const i = text.toLowerCase().indexOf(term.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-sm bg-yellow-200 px-0.5 text-gray-900">
        {text.slice(i, i + term.length)}
      </mark>
      {text.slice(i + term.length)}
    </>
  );
}

interface UserSearchComboboxProps {
  isDark: boolean;
  onSelect: (user: AdminSearchUser) => void;
  autoFocus?: boolean;
}

export function UserSearchCombobox({
  isDark,
  onSelect,
  autoFocus,
}: UserSearchComboboxProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [scope, setScope] = useState<UserSearchScope>("all");
  const [userType, setUserType] = useState<UserSearchType>("all");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminSearchUser[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const scopeMeta = USER_SEARCH_SCOPES.find((s) => s.value === scope)!;
  const term = normalizeSearchTerm(scope, query);
  const tooShort = term.length < minQueryLength(scope);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // Debounced search; aborts stale requests so results never arrive out of order.
  useEffect(() => {
    if (tooShort) {
      setResults([]);
      setHasMore(false);
      setError(null);
      setSearched("");
      setIsSearching(false);
      return;
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      setError(null);
      try {
        const params = new URLSearchParams({ q: term, scope, type: userType });
        const response = await fetch(`/api/admin/search-users?${params}`, {
          signal: controller.signal,
        });
        const data = await response.json();
        if (response.ok && data.success) {
          setResults(data.users || []);
          setHasMore(Boolean(data.hasMore));
        } else {
          setResults([]);
          setHasMore(false);
          setError(data.error || "Search failed");
        }
        setSearched(term);
        setActiveIndex(0);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        console.error("Error searching users:", err);
        setResults([]);
        setError("Search failed. Check your connection and try again.");
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 300);
    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [term, scope, userType, tooShort]);

  const changeScope = (next: UserSearchScope) => {
    setScope(next);
    setActiveIndex(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleChange = (value: string) => {
    if (scope === "all") {
      const shortcut = detectScopeShortcut(value);
      if (shortcut) {
        setScope(shortcut.scope);
        setQuery(shortcut.rest);
        return;
      }
    }
    setQuery(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && query === "" && scope !== "all") {
      e.preventDefault();
      setScope("all");
      return;
    }
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const user = results[activeIndex];
      if (user) onSelect(user);
    }
  };

  const showList = !tooShort && (results.length > 0 || (!isSearching && searched === term));
  const muted = isDark ? "text-gray-400" : "text-gray-500";
  const kbd = cn(
    "rounded border px-1 font-mono text-[11px]",
    isDark ? "border-gray-700 bg-[#130a33] text-gray-300" : "border-gray-200 bg-gray-50 text-gray-600"
  );

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "flex items-center gap-2 rounded-md border px-1.5 py-1 transition-shadow focus-within:ring-2",
          isDark
            ? "border-gray-700 bg-[#06021d] focus-within:border-white/30 focus-within:ring-[#1a1a1a]/30"
            : "border-gray-300 bg-white focus-within:border-[#1a1a1a] focus-within:ring-[#1a1a1a]/15"
        )}
      >
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Search scope: ${scopeMeta.label}`}
              className={cn(
                "flex shrink-0 items-center gap-1 rounded px-2 py-1.5 text-xs font-semibold outline-none focus-visible:ring-2",
                isDark
                  ? "bg-white/10 text-white focus-visible:ring-[#1a1a1a]"
                  : "bg-[#f3f3f5] text-[#1a1a1a] focus-visible:ring-[#1a1a1a]"
              )}
            >
              {scope === "all" ? (
                <Search className="h-3.5 w-3.5" />
              ) : scope === "username" ? (
                <span aria-hidden="true">@</span>
              ) : null}
              {scopeMeta.label}
              <ChevronDown className="h-3.5 w-3.5 opacity-70" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className={cn(
              "z-[60] min-w-[220px] p-1",
              isDark ? "border-gray-700 bg-[#130a33] text-white" : "border-gray-200 bg-white text-gray-900"
            )}
          >
            {USER_SEARCH_SCOPES.map((s) => (
              <DropdownMenuItem
                key={s.value}
                onSelect={() => changeScope(s.value)}
                className={cn(
                  "flex justify-between gap-6 cursor-pointer",
                  s.value === scope && (isDark ? "bg-white/10" : "bg-[#f3f3f5]"),
                  isDark ? "focus:bg-[#1b0f44] focus:text-white" : "focus:bg-gray-100"
                )}
              >
                <span>{s.label}</span>
                <span className={kbd}>{s.shortcut ?? "default"}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <input
          ref={inputRef}
          id="user-search"
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            results[activeIndex] ? `${listId}-${results[activeIndex].id}` : undefined
          }
          autoComplete="off"
          maxLength={USER_SEARCH_MAX_LENGTH + 10}
          placeholder={scopeMeta.placeholder}
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className={cn(
            "min-w-0 flex-1 bg-transparent px-1 py-1.5 text-sm outline-none",
            isDark ? "text-white placeholder:text-gray-500" : "text-gray-900 placeholder:text-gray-400"
          )}
        />
        {isSearching && <Loader2 className={cn("h-4 w-4 animate-spin", muted)} />}
        {(query || scope !== "all") && !isSearching && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setQuery("");
              setScope("all");
              inputRef.current?.focus();
            }}
            className={cn("rounded p-1", muted, isDark ? "hover:bg-[#1b0f44]" : "hover:bg-gray-100")}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-xs", muted)}>
          <span>Shortcuts:</span>
          <span>
            <span className={kbd}>@</span> username
          </span>
          <span className={kbd}>name:</span>
          <span className={kbd}>email:</span>
          <span>
            <span className={kbd}>id:</span> or <span className={kbd}>#</span> user ID
          </span>
        </div>
        <div className="flex gap-1.5" role="group" aria-label="User type">
          {TYPE_FILTERS.map((t) => (
            <button
              key={t.value}
              type="button"
              aria-pressed={userType === t.value}
              onClick={() => setUserType(t.value)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                userType === t.value
                  ? isDark
                    ? "border-white/30 bg-white/10 text-white"
                    : "border-[#1a1a1a] bg-[#f3f3f5] text-[#1a1a1a]"
                  : isDark
                    ? "border-gray-700 text-gray-400 hover:text-white"
                    : "border-gray-300 text-gray-600 hover:text-gray-900"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {showList && (
        <div
          id={listId}
          role="listbox"
          className={cn(
            "max-h-72 overflow-y-auto rounded-lg border",
            isDark ? "border-gray-700 bg-[#130a33]" : "border-gray-200 bg-white"
          )}
        >
          {error ? (
            <p className={cn("p-4 text-center text-sm", isDark ? "text-red-300" : "text-red-700")}>
              {error}
            </p>
          ) : results.length === 0 ? (
            <p className={cn("p-4 text-center text-sm", muted)}>
              No users match {scope === "username" ? "@" : ""}
              {term} in {scopeMeta.label}.
              {scope !== "all" && " Try All to search every field."}
            </p>
          ) : (
            <>
              {results.map((user, i) => (
                <div
                  key={user.id}
                  id={`${listId}-${user.id}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  onMouseEnter={() => setActiveIndex(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onSelect(user)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 border-b px-3 py-2.5 last:border-b-0",
                    isDark ? "border-gray-800 text-white" : "border-gray-100 text-gray-900",
                    i === activeIndex && (isDark ? "bg-[#1b0f44]" : "bg-gray-50")
                  )}
                >
                  <UserAvatar user={user} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 font-medium">
                      {user.matched_field === "name" ? (
                        <Highlight text={userDisplayName(user)} term={term} />
                      ) : (
                        userDisplayName(user)
                      )}
                      <UserTypeBadge userType={user.user_type} isDark={isDark} />
                      {scope === "all" && user.matched_field && (
                        <span className={cn("text-[10px] uppercase tracking-wide", muted)}>
                          matched {MATCH_LABEL[user.matched_field]}
                        </span>
                      )}
                    </div>
                    <div className={cn("truncate text-xs", muted)}>
                      {user.username && (
                        <>
                          @
                          {user.matched_field === "username" ? (
                            <Highlight text={user.username} term={term} />
                          ) : (
                            user.username
                          )}
                          {" · "}
                        </>
                      )}
                      {user.matched_field === "email" ? (
                        <Highlight text={user.email} term={term} />
                      ) : (
                        user.email
                      )}
                    </div>
                    <div className={cn("truncate font-mono text-[11px]", muted)}>
                      {user.matched_field === "id" ? (
                        <Highlight text={user.id} term={term} />
                      ) : (
                        `${user.id.slice(0, 8)}…`
                      )}
                    </div>
                  </div>
                  <div className="hidden text-right text-xs tabular-nums sm:block">
                    <div className="text-sm font-semibold">{(user.coins ?? 0).toLocaleString()}</div>
                    <div className={muted}>coins</div>
                  </div>
                </div>
              ))}
              {hasMore && (
                <p className={cn("px-3 py-2 text-center text-xs", muted)}>
                  Showing the top {results.length}. Refine your search to see others.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
