import { redirect } from "next/navigation";
import { verifyAdminAccess } from "@/utils/admin-auth";
import AdminAnalyticsClient from "./admin-analytics-client";

export default async function AdminAnalyticsPage() {
  const { isAdmin, error } = await verifyAdminAccess();

  if (!isAdmin) {
    console.log("Non-admin user attempted to access admin analytics:", error);
    redirect("/dashboard");
  }

  return <AdminAnalyticsClient />;
}
