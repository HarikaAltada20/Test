"use client";
import { useState } from "react";
import { EnhancedTabs } from "@/components/ui/enhancedTabs";

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
  const queries = initialQueries || [];
  const contacts = initialContacts || [];

  const tabs = [
    { id: "queries", label: "Queries", count: queries.length },
    { id: "contacts", label: "Contacts", count: contacts.length },
  ];

  const renderQueries = () => (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2 pr-4">Created</th>
            <th className="py-2 pr-4">User Type</th>
            <th className="py-2 pr-4">Query</th>
            <th className="py-2 pr-4">Email</th>
            <th className="py-2 pr-4">Username</th>
          </tr>
        </thead>
        <tbody>
          {queries.map((q) => (
            <tr key={q.id} className="border-b">
              <td className="py-2 pr-4">
                {new Date(q.created_at).toLocaleString()}
              </td>
              <td className="py-2 pr-4">{q.user_type || "-"}</td>
              <td className="py-2 pr-4">{q.query_text || "-"}</td>
              <td className="py-2 pr-4">{q.users?.email || "-"}</td>
              <td className="py-2 pr-4">{q.users?.username || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderContacts = () => (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2 pr-4">Created</th>
            <th className="py-2 pr-4">Name</th>
            <th className="py-2 pr-4">Email</th>
            <th className="py-2 pr-4">Phone</th>
            <th className="py-2 pr-4">Message</th>
          </tr>
        </thead>
        <tbody>
          {contacts.map((c) => (
            <tr key={c.id} className="border-b">
              <td className="py-2 pr-4">
                {new Date(c.created_at).toLocaleString()}
              </td>
              <td className="py-2 pr-4">{c.name || "-"}</td>
              <td className="py-2 pr-4">{c.email || "-"}</td>
              <td className="py-2 pr-4">{c.phone || "-"}</td>
              <td className="py-2 pr-4">{c.message || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      <EnhancedTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        className="w-full max-w-md"
      />
      <div className="mt-6">
        {activeTab === "queries" && renderQueries()}
        {activeTab === "contacts" && renderContacts()}
      </div>
    </div>
  );
}
