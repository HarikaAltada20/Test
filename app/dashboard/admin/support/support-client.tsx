"use client";
import { useState, useMemo, useEffect } from "react";
import { EnhancedTabs } from "@/components/ui/enhancedTabs";
import { Card, CardContent } from "@/components/ui/card";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { cn } from "@/lib/utils";

type Query = {
  id: string;
  created_at: string;
  user_type?: string | null;
  query_text?: string | null;
  user_id?: string | null;
  users?: {
    email: string;
    username: string | null;
  } | null;
};
type Contact = {
  id: string;
  created_at: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  message?: string | null;
};

export default function SupportClient({
  initialQueries,
  initialContacts,
}: {
  initialQueries: Query[] | null | undefined;
  initialContacts: Contact[] | null | undefined;
}) {
  const [activeTab, setActiveTab] = useState("queries");
  const [queriesPage, setQueriesPage] = useState(1);
  const [queriesLimit, setQueriesLimit] = useState(25);
  const [contactsPage, setContactsPage] = useState(1);
  const [contactsLimit, setContactsLimit] = useState(25);

  // Get theme from parent layout
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

  const queries = initialQueries || [];
  const contacts = initialContacts || [];

  // Reset page when switching tabs
  useEffect(() => {
    setQueriesPage(1);
    setContactsPage(1);
  }, [activeTab]);

  // Paginated queries
  const paginatedQueries = useMemo(() => {
    const start = (queriesPage - 1) * queriesLimit;
    const end = start + queriesLimit;
    return queries.slice(start, end);
  }, [queries, queriesPage, queriesLimit]);

  const queriesTotalPages = Math.ceil(queries.length / queriesLimit);
  const queriesHasNextPage = queriesPage < queriesTotalPages;
  const queriesHasPreviousPage = queriesPage > 1;

  // Paginated contacts
  const paginatedContacts = useMemo(() => {
    const start = (contactsPage - 1) * contactsLimit;
    const end = start + contactsLimit;
    return contacts.slice(start, end);
  }, [contacts, contactsPage, contactsLimit]);

  const contactsTotalPages = Math.ceil(contacts.length / contactsLimit);
  const contactsHasNextPage = contactsPage < contactsTotalPages;
  const contactsHasPreviousPage = contactsPage > 1;

  const tabs = [
    { id: "queries", label: "Queries", count: queries.length },
    { id: "contacts", label: "Contacts", count: contacts.length },
  ];

  const renderQueries = () => (
    <Card
      className={cn(
        "border shadow-sm",
        isDark ? "bg-[#06021D] border-slate-700" : "bg-white border-slate-200"
      )}
    >
      <CardContent className="p-6">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th
                  className={cn(
                    "py-2 pr-4",
                    isDark ? "text-slate-200" : "text-foreground"
                  )}
                >
                  Created
                </th>
                <th
                  className={cn(
                    "py-2 pr-4",
                    isDark ? "text-slate-200" : "text-foreground"
                  )}
                >
                  User Type
                </th>
                <th
                  className={cn(
                    "py-2 pr-4",
                    isDark ? "text-slate-200" : "text-foreground"
                  )}
                >
                  Query
                </th>
                <th
                  className={cn(
                    "py-2 pr-4",
                    isDark ? "text-slate-200" : "text-foreground"
                  )}
                >
                  Email
                </th>
                <th
                  className={cn(
                    "py-2 pr-4",
                    isDark ? "text-slate-200" : "text-foreground"
                  )}
                >
                  Username
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedQueries.length > 0 ? (
                paginatedQueries.map((q) => (
                  <tr
                    key={q.id}
                    className={cn(
                      "border-b",
                      isDark ? "border-slate-700" : "border-slate-200"
                    )}
                  >
                    <td
                      className={cn(
                        "py-2 pr-4",
                        isDark ? "text-slate-300" : "text-foreground"
                      )}
                    >
                      {new Date(q.created_at).toLocaleString()}
                    </td>
                    <td
                      className={cn(
                        "py-2 pr-4",
                        isDark ? "text-slate-300" : "text-foreground"
                      )}
                    >
                      {q.user_type || "-"}
                    </td>
                    <td
                      className={cn(
                        "py-2 pr-4",
                        isDark ? "text-slate-300" : "text-foreground"
                      )}
                    >
                      {q.query_text || "-"}
                    </td>
                    <td
                      className={cn(
                        "py-2 pr-4",
                        isDark ? "text-slate-300" : "text-foreground"
                      )}
                    >
                      {q.users?.email || "-"}
                    </td>
                    <td
                      className={cn(
                        "py-2 pr-4",
                        isDark ? "text-slate-300" : "text-foreground"
                      )}
                    >
                      {q.users?.username || "-"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className={cn(
                      "py-8 text-center",
                      isDark ? "text-slate-400" : "text-muted-foreground"
                    )}
                  >
                    No queries found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {queries.length > 0 && (
          <div className="mt-6">
            <PaginationControls
              page={queriesPage}
              limit={queriesLimit}
              total={queries.length}
              totalPages={queriesTotalPages}
              hasNextPage={queriesHasNextPage}
              hasPreviousPage={queriesHasPreviousPage}
              onPageChange={setQueriesPage}
              onLimitChange={(limit) => {
                setQueriesLimit(limit);
                setQueriesPage(1);
              }}
              isDark={isDark}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderContacts = () => (
    <Card
      className={cn(
        "border shadow-sm",
        isDark ? "bg-[#06021D] border-slate-700" : "bg-white border-slate-200"
      )}
    >
      <CardContent className="p-6">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th
                  className={cn(
                    "py-2 pr-4",
                    isDark ? "text-slate-200" : "text-foreground"
                  )}
                >
                  Created
                </th>
                <th
                  className={cn(
                    "py-2 pr-4",
                    isDark ? "text-slate-200" : "text-foreground"
                  )}
                >
                  Name
                </th>
                <th
                  className={cn(
                    "py-2 pr-4",
                    isDark ? "text-slate-200" : "text-foreground"
                  )}
                >
                  Email
                </th>
                <th
                  className={cn(
                    "py-2 pr-4",
                    isDark ? "text-slate-200" : "text-foreground"
                  )}
                >
                  Phone
                </th>
                <th
                  className={cn(
                    "py-2 pr-4",
                    isDark ? "text-slate-200" : "text-foreground"
                  )}
                >
                  Message
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedContacts.length > 0 ? (
                paginatedContacts.map((c) => (
                  <tr
                    key={c.id}
                    className={cn(
                      "border-b",
                      isDark ? "border-slate-700" : "border-slate-200"
                    )}
                  >
                    <td
                      className={cn(
                        "py-2 pr-4",
                        isDark ? "text-slate-300" : "text-foreground"
                      )}
                    >
                      {new Date(c.created_at).toLocaleString()}
                    </td>
                    <td
                      className={cn(
                        "py-2 pr-4",
                        isDark ? "text-slate-300" : "text-foreground"
                      )}
                    >
                      {c.name || "-"}
                    </td>
                    <td
                      className={cn(
                        "py-2 pr-4",
                        isDark ? "text-slate-300" : "text-foreground"
                      )}
                    >
                      {c.email || "-"}
                    </td>
                    <td
                      className={cn(
                        "py-2 pr-4",
                        isDark ? "text-slate-300" : "text-foreground"
                      )}
                    >
                      {c.phone || "-"}
                    </td>
                    <td
                      className={cn(
                        "py-2 pr-4",
                        isDark ? "text-slate-300" : "text-foreground"
                      )}
                    >
                      {c.message || "-"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className={cn(
                      "py-8 text-center",
                      isDark ? "text-slate-400" : "text-muted-foreground"
                    )}
                  >
                    No contacts found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {contacts.length > 0 && (
          <div className="mt-6">
            <PaginationControls
              page={contactsPage}
              limit={contactsLimit}
              total={contacts.length}
              totalPages={contactsTotalPages}
              hasNextPage={contactsHasNextPage}
              hasPreviousPage={contactsHasPreviousPage}
              onPageChange={setContactsPage}
              onLimitChange={(limit) => {
                setContactsLimit(limit);
                setContactsPage(1);
              }}
              isDark={isDark}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <EnhancedTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        className="w-full max-w-md"
        isDark={isDark}
      />
      <div className="mt-6">
        {activeTab === "queries" && renderQueries()}
        {activeTab === "contacts" && renderContacts()}
      </div>
    </div>
  );
}
