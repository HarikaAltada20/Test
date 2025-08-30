"use client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type Query = { id: string; created_at: string; user_type?: string | null; query_text?: string | null; user_id?: string | null };
type Contact = { id: string; created_at: string; name?: string | null; email?: string | null; phone?: string | null; message?: string | null };

export default function SupportClient({ initialQueries, initialContacts }: { initialQueries: Query[]; initialContacts: Contact[] }) {
    const renderQueries = () => (
        <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
                <thead>
                    <tr className="text-left border-b">
                        <th className="py-2 pr-4">Created</th>
                        <th className="py-2 pr-4">User Type</th>
                        <th className="py-2 pr-4">Query</th>
                        <th className="py-2 pr-4">User Id</th>
                    </tr>
                </thead>
                <tbody>
                    {initialQueries.map(q => (
                        <tr key={q.id} className="border-b">
                            <td className="py-2 pr-4">{new Date(q.created_at).toLocaleString()}</td>
                            <td className="py-2 pr-4">{q.user_type || '-'}</td>
                            <td className="py-2 pr-4">{q.query_text || '-'}</td>
                            <td className="py-2 pr-4">{q.user_id || '-'}</td>
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
                    {initialContacts.map(c => (
                        <tr key={c.id} className="border-b">
                            <td className="py-2 pr-4">{new Date(c.created_at).toLocaleString()}</td>
                            <td className="py-2 pr-4">{c.name || '-'}</td>
                            <td className="py-2 pr-4">{c.email || '-'}</td>
                            <td className="py-2 pr-4">{c.phone || '-'}</td>
                            <td className="py-2 pr-4">{c.message || '-'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    return (
        <Tabs defaultValue="queries">
            <TabsList>
                <TabsTrigger value="queries">Queries</TabsTrigger>
                <TabsTrigger value="contacts">Contacts</TabsTrigger>
            </TabsList>
            <TabsContent value="queries">{renderQueries()}</TabsContent>
            <TabsContent value="contacts">{renderContacts()}</TabsContent>
        </Tabs>
    );
}


