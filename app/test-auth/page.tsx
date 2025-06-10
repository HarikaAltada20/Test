"use client";

import { createClient } from "@/utils/supabase/client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TestAuthPage() {
    const [user, setUser] = useState<any>(null);
    const [session, setSession] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        const getSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            const { data: { user } } = await supabase.auth.getUser();

            setSession(session);
            setUser(user);
            setLoading(false);
        };

        getSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                console.log('Auth state changed:', event, session);
                setSession(session);
                setUser(session?.user || null);
            }
        );

        return () => subscription.unsubscribe();
    }, [supabase]);

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    if (loading) {
        return <div className="p-8">Loading...</div>;
    }

    return (
        <div className="container mx-auto p-8 space-y-6">
            <h1 className="text-3xl font-bold">Authentication Test Page</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Authentication Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <p><strong>Authenticated:</strong> {user ? 'Yes' : 'No'}</p>
                            <p><strong>User ID:</strong> {user?.id || 'N/A'}</p>
                            <p><strong>Email:</strong> {user?.email || 'N/A'}</p>
                            <p><strong>Email Confirmed:</strong> {user?.email_confirmed_at ? 'Yes' : 'No'}</p>
                            <p><strong>Created At:</strong> {user?.created_at || 'N/A'}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Authentication Providers</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <p><strong>Providers:</strong></p>
                            <ul className="list-disc list-inside">
                                {user?.app_metadata?.providers?.map((provider: string) => (
                                    <li key={provider}>{provider}</li>
                                )) || <li>None</li>}
                            </ul>
                            <p><strong>Has Password:</strong> {user?.app_metadata?.providers?.includes('email') ? 'Yes' : 'No'}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>User Metadata</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <pre className="text-sm bg-gray-100 p-2 rounded overflow-auto">
                            {JSON.stringify(user?.user_metadata || {}, null, 2)}
                        </pre>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>App Metadata</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <pre className="text-sm bg-gray-100 p-2 rounded overflow-auto">
                            {JSON.stringify(user?.app_metadata || {}, null, 2)}
                        </pre>
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-4">
                <h2 className="text-2xl font-semibold">Quick Actions</h2>
                <div className="flex gap-4">
                    {user ? (
                        <Button onClick={signOut} variant="destructive">
                            Sign Out
                        </Button>
                    ) : (
                        <div className="space-x-2">
                            <Button asChild>
                                <a href="/auth/signin">Sign In</a>
                            </Button>
                            <Button asChild variant="outline">
                                <a href="/auth/signup">Sign Up</a>
                            </Button>
                        </div>
                    )}
                    <Button asChild variant="outline">
                        <a href="/dashboard/settings">Settings</a>
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Session Information</CardTitle>
                </CardHeader>
                <CardContent>
                    <pre className="text-sm bg-gray-100 p-2 rounded overflow-auto max-h-96">
                        {JSON.stringify(session, null, 2)}
                    </pre>
                </CardContent>
            </Card>
        </div>
    );
} 