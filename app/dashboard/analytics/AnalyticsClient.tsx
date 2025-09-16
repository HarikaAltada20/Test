
// import { createClient } from "@/utils/supabase/server";
// import { redirect } from "next/navigation";
// import { RouteGuard } from "@/components/guards/RouteGuard";
// import {
//   Card,
//   CardContent,
//   CardDescription,
//   CardHeader,
//   CardTitle,
// } from "@/components/ui/card";
// import { BarChart, DollarSign, EyeIcon, TrendingUp, Users } from "lucide-react";
// // import {
// //   EnhancedTabs as Tabs,
// //   EnhancedTabsList as TabsList,
// //   EnhancedTabsTrigger as TabsTrigger,
// //   EnhancedTabsContent as TabsContent,
// // } from "@/components/ui/enhanced-tabs";
// import { formatCurrencyFromCents } from "@/lib/currency-utils";
// import { EnhancedTabs } from "@/components/ui/enhancedTabs";
// import { TabContent, TabPanel } from '@/components/ui/tab-content';
// import { useTabState } from '@/components/ui/tab-utils';


// const tabs = [
//   { id: 'overview', label: 'Overview' },
//   { id: 'contests', label: 'Contests' },
//   { id: 'creators', label: 'Creators' },
// ];

// export default async function AnalyticsPage() {
//   const supabase = await createClient();
//   const { activeTab, setActiveTab } = useTabState(tabs, { defaultTab: 'overview' });

  
//   const {
//     data: { user },
//   } = await supabase.auth.getUser();

//   if (!user) {
//     redirect("/auth/signin");
//   }

//   const { data: userData, error: userError } = await supabase
//     .from("users")
//     .select("user_type")
//     .eq("id", user.id)
//     .single();

//   if (userError) {
//     console.error("Error fetching user data:", userError);
//     redirect("/dashboard?error=user_fetch_failed");
//   }

//   // Only allow advertisers to access this page
//   if (userData?.user_type !== "advertiser") {
//     console.warn(
//       `User ${user.id} with type ${userData?.user_type} attempted to access analytics page.`
//     );
//     redirect("/dashboard");
//   }

//   // Fetch analytics data
//   const { data: contests } = await supabase
//     .from("contests")
//     .select("*")
//     .eq("advertiser_id", user.id);

//   const { data: submissions } = await supabase
//     .from("submissions")
//     .select("*, contests!inner(*)")
//     .eq("contests.advertiser_id", user.id);

//   // Calculate analytics
//   const totalContests = contests?.length || 0;
//   const totalSubmissions = submissions?.length || 0;
//   const totalViews =
//     submissions?.reduce((sum, sub) => sum + (sub.views || 0), 0) || 0;
//   const totalSpent =
//     contests?.reduce((sum, contest) => {
//       if (
//         contest.contest_type === "leaderboard" &&
//         contest.contest_based_details?.leaderboard_contest?.total_prize
//       ) {
//         return (
//           sum + contest.contest_based_details.leaderboard_contest.total_prize
//         );
//       } else if (
//         contest.contest_type === "cpm" &&
//         contest.contest_based_details?.cpm_contest?.total_budget
//       ) {
//         return sum + contest.contest_based_details.cpm_contest.total_budget;
//       }
//       return sum;
//     }, 0) || 0;

//   return (
//     <RouteGuard
//       allowedUserTypes={["advertiser"]}
//       fallbackPath="/dashboard/opportunities"
//     >
//       <div>
//         <div className="flex items-center justify-between mb-6">
//           <h1 className="text-2xl font-bold">Analytics</h1>
//         </div>

//         {/* Analytics Cards */}
//         <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
//           <div className="bg-white rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2">
//             <CardContent className="p-4">
//               <div className="flex justify-between">
//                 {/* <div className="w-10 h-10 flex items-center justify-center rounded-full bg-purple-100 text-purple-600 mb-4">
//                     <DollarSign className="w-5 h-5" />
//                   </div> */}
//                 <div className="flex-1 text-black space-y-3">
//                   <p className="text-lg font-medium">Total Contests</p>
//                   <p className="text-xl font-bold ">{totalContests}</p>
//                   <p className="text-md mt-0.5">Contests created</p>
//                 </div>
//                 <div className="w-10 h-10 flex items-center justify-center rounded-full bg-[#D8C3FF] text-[#4A00BE] mb-4">
//                   <BarChart className="h-4 w-4 " />
//                 </div>
//               </div>
//             </CardContent>
//           </div>
//           {/* 
//           <Card>
//             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
//               <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
//               <Users className="h-4 w-4 text-muted-foreground" />
//             </CardHeader>
//             <CardContent>
//               <div className="text-2xl font-bold">{totalSubmissions}</div>
//               <p className="text-xs text-muted-foreground">Creator submissions</p>
//             </CardContent>
//           </Card> */}

//           <div className="bg-white rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2">
//             <CardContent className="p-4">
//               <div className="flex justify-between">
//                 {/* <div className="w-10 h-10 flex items-center justify-center rounded-full bg-purple-100 text-purple-600 mb-4">
//                     <DollarSign className="w-5 h-5" />
//                   </div> */}
//                 <div className="flex-1 text-black space-y-3">
//                   <p className="text-lg font-medium">Total Submissions</p>
//                   <p className="text-xl font-bold ">{totalSubmissions}</p>
//                   <p className="text-md mt-0.5">Creator submissions</p>
//                 </div>
//                 <div className="w-10 h-10 flex items-center justify-center rounded-full bg-[#D8C3FF] text-[#4A00BE] mb-4">
//                   <Users className="h-4 w-4" />
//                 </div>
//               </div>
//             </CardContent>
//           </div>
//           {/* <Card>
//             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
//               <CardTitle className="text-sm font-medium">Total Views</CardTitle>
//               <EyeIcon className="h-4 w-4 text-muted-foreground" />
//             </CardHeader>
//             <CardContent>
//               <div className="text-2xl font-bold">{totalViews.toLocaleString()}</div>
//               <p className="text-xs text-muted-foreground">Across all submissions</p>
//             </CardContent>
//           </Card> */}

//           <div className="bg-white rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2">
//             <CardContent className="p-4">
//               <div className="flex justify-between">
//                 {/* <div className="w-10 h-10 flex items-center justify-center rounded-full bg-purple-100 text-purple-600 mb-4">
//                     <DollarSign className="w-5 h-5" />
//                   </div> */}
//                 <div className="flex-1 text-black space-y-3">
//                   <p className="text-lg font-medium">Total Views</p>
//                   <p className="text-xl font-bold ">
//                     {totalViews.toLocaleString()}
//                   </p>
//                   <p className="text-md mt-0.5">Across all submissions</p>
//                 </div>
//                 <div className="w-10 h-10 flex items-center justify-center rounded-full bg-[#D8C3FF] text-[#4A00BE] mb-4">
//                   <EyeIcon className="h-5 w-5" />
//                 </div>
//               </div>
//             </CardContent>
//           </div>
//           {/* <Card>
//             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
//               <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
//               <DollarSign className="h-4 w-4 text-muted-foreground" />
//             </CardHeader>
//             <CardContent>
//               <div className="text-2xl font-bold">{formatCurrencyFromCents(totalSpent)}</div>
//               <p className="text-xs text-muted-foreground">Contest budgets</p>
//             </CardContent>
//           </Card> */}

//           <div className="bg-white rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2">
//             <CardContent className="p-4">
//               <div className="flex justify-between">
//                 {/* <div className="w-10 h-10 flex items-center justify-center rounded-full bg-purple-100 text-purple-600 mb-4">
//                     <DollarSign className="w-5 h-5" />
//                   </div> */}
//                 <div className="flex-1 text-black space-y-3">
//                   <p className="text-lg font-medium">Total Spent</p>
//                   <p className="text-xl font-bold ">
//                   {formatCurrencyFromCents(totalSpent)}
//                   </p>
//                   <p className="text-md mt-0.5">Contest budgets</p>
//                 </div>
//                 <div className="w-10 h-10 flex items-center justify-center rounded-full bg-[#D8C3FF] text-[#4A00BE] mb-4">
//                 <DollarSign className="h-4 w-4" />
//                 </div>
//               </div>
//             </CardContent>
//           </div>
//         </div>

//         {/* Analytics Tabs */}

        
//         <div className="mb-6">
//           <EnhancedTabs
//             tabs={tabs}
//             activeTab={activeTab}
//             onTabChange={setActiveTab}
//             className="max-w-md"
//           />
//         </div>
//         <TabContent activeTab={activeTab}>
//         <TabPanel value="overview" activeTab={activeTab}>
        
//             <div className="mt-10">
//               <div className="bg-white rounded-tl-xl rounded-tr-xl border-b px-6 py-4  shadow-md">
//                 <CardTitle className="text-2xl text-[#7F39EC]">Overview</CardTitle>
                
//               </div>
//               <CardContent className="bg-white rounded-bl-xl rounded-br-xl shadow-md space-y-3 pt-4">
//               <CardDescription className="text-md mt-1">Your contest performance overview</CardDescription>
//                 <p className="text-muted-foreground">
//                 Detailed analytics coming soon. Track your contest
//                 performance, creator engagement, and ROI.
//                 </p>
//               </CardContent>
//             </div>
//           </TabPanel>

//           <TabPanel value="contests" activeTab={activeTab}>
//             <div className="mt-10">
//               <div className="bg-white rounded-tl-xl rounded-tr-xl border-b px-6 py-4  shadow-md">
//                 <CardTitle className="text-2xl text-[#7F39EC]">Contest Performance</CardTitle>
                
//               </div>
//               <CardContent className="bg-white rounded-bl-xl rounded-br-xl shadow-md space-y-3 pt-4">
//               <CardDescription className="text-md mt-1">Individual contest analytics</CardDescription>
//                 <p className="text-muted-foreground">
//                   Contest-specific analytics coming soon. View submissions,
//                   views, and engagement per contest.
//                 </p>
//               </CardContent>
//             </div>
//             </TabPanel>

//             <TabPanel value="creators" activeTab={activeTab}>
//             <div className="mt-10">
//               <div className="bg-white rounded-tl-xl rounded-tr-xl border-b px-6 py-4  shadow-md">
//                 <CardTitle className="text-2xl text-[#7F39EC]">Creator Insights</CardTitle>
                
//               </div>
//               <CardContent className="bg-white rounded-bl-xl rounded-br-xl shadow-md space-y-3 pt-4">
//               <CardDescription className="text-md mt-1">Creator performance and demographics</CardDescription>
//                 <p className="text-muted-foreground">
//                 Creator analytics coming soon. Understand your creator
//                 audience and top performers.
//                 </p>
//               </CardContent>
//             </div>
//             </TabPanel>
//             </TabContent>
        
        
//       </div>
//     </RouteGuard>
//   );
// }




"use client";
import { useState, useEffect } from "react";
import { BarChart, DollarSign, EyeIcon, Loader2, Users } from "lucide-react";
import { CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { EnhancedTabs } from "@/components/ui/enhancedTabs";
import { TabContent, TabPanel } from "@/components/ui/tab-content";
import { useTabState } from "@/components/ui/tab-utils";
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import { PageLoadingSpinner } from "@/components/loading/LoadingSpinner";

type AnalyticsClientProps = {
  totalContests: number;
  totalSubmissions: number;
  totalViews: number;
  totalSpent: string;
};

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "contests", label: "Contests" },
  { id: "creators", label: "Creators" },
] 

export default function AnalyticsClient({
  totalContests,
  totalSubmissions,
  totalViews,
  totalSpent,
}: AnalyticsClientProps) {
  const { activeTab, setActiveTab } = useTabState(tabs, { defaultTab: "overview" });
  const [loading, setLoading] = useState(true);

  // Simulate loading
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1000); 
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] space-y-4">
       <PageLoadingSpinner mode="light"/>
        {/* <p className="text-lg font-medium text-gray-600">Loading analytics...</p> */}
      </div>
    );
  }
  return (
    <div>
      {/* Analytics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        {/* Total Contests */}
        <div className="bg-white rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2">
          <CardContent className="p-4 flex justify-between">
            <div className="flex-1 text-black space-y-3">
              <p className="text-lg font-medium">Total Contests</p>
              <p className="text-xl font-bold">{totalContests}</p>
              <p className="text-md">Contests created</p>
            </div>
            <div className="w-10 h-10 flex items-center justify-center rounded-full bg-[#D8C3FF] text-[#4A00BE]">
              <BarChart className="h-4 w-4" />
            </div>
          </CardContent>
        </div>

        {/* Submissions */}
        <div className="bg-white rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2">
          <CardContent className="p-4 flex justify-between">
            <div className="flex-1 text-black space-y-3">
              <p className="text-lg font-medium">Total Submissions</p>
              <p className="text-xl font-bold">{totalSubmissions}</p>
              <p className="text-md">Creator submissions</p>
            </div>
            <div className="w-10 h-10 flex items-center justify-center rounded-full bg-[#D8C3FF] text-[#4A00BE]">
              <Users className="h-4 w-4" />
            </div>
          </CardContent>
        </div>

        {/* Views */}
        <div className="bg-white rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2">
          <CardContent className="p-4 flex justify-between">
            <div className="flex-1 text-black space-y-3">
              <p className="text-lg font-medium">Total Views</p>
              <p className="text-xl font-bold">{totalViews.toLocaleString()}</p>
              <p className="text-md">Across all submissions</p>
            </div>
            <div className="w-10 h-10 flex items-center justify-center rounded-full bg-[#D8C3FF] text-[#4A00BE]">
              <EyeIcon className="h-5 w-5" />
            </div>
          </CardContent>
        </div>

        {/* Spent */}
        <div className="bg-white rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2">
          <CardContent className="p-4 flex justify-between">
            <div className="flex-1 text-black space-y-3">
              <p className="text-lg font-medium">Total Spent</p>
              <p className="text-xl font-bold">{totalSpent}</p>
              <p className="text-md">Contest budgets</p>
            </div>
            <div className="w-10 h-10 flex items-center justify-center rounded-full bg-[#D8C3FF] text-[#4A00BE]">
              <DollarSign className="h-4 w-4" />
            </div>
          </CardContent>
        </div>
      </div>

      {/* Tabs */}
      <EnhancedTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        className="mt-12 mb-6"
      />

      <TabContent activeTab={activeTab}>
        <TabPanel value="overview" activeTab={activeTab}>
          <div className="mt-10">
            <div className="bg-white rounded-t-xl border-b px-6 py-4 shadow-md">
              <CardTitle className="text-2xl text-[#7F39EC]">Overview</CardTitle>
            </div>
            <CardContent className="bg-white rounded-b-xl shadow-md space-y-3 pt-4">
              <CardDescription>Your contest performance overview</CardDescription>
              <p className="text-muted-foreground"> Detailed analytics coming soon. Track your contest
                          performance, creator engagement, and ROI.</p>
            </CardContent>
          </div>
        </TabPanel>

        <TabPanel value="contests" activeTab={activeTab}>
          <div className="mt-10">
            <div className="bg-white rounded-t-xl border-b px-6 py-4 shadow-md">
              <CardTitle className="text-2xl text-[#7F39EC]">Contest Performance</CardTitle>
            </div>
            <CardContent className="bg-white rounded-b-xl shadow-md space-y-3 pt-4">
              <CardDescription>Individual contest analytics</CardDescription>
              <p className="text-muted-foreground"> Contest-specific analytics coming soon. View submissions,
                                  views, and engagement per contest.</p>
            </CardContent>
          </div>
        </TabPanel>

        <TabPanel value="creators" activeTab={activeTab}>
          <div className="mt-10">
            <div className="bg-white rounded-t-xl border-b px-6 py-4 shadow-md">
              <CardTitle className="text-2xl text-[#7F39EC]">Creator Insights</CardTitle>
            </div>
            <CardContent className="bg-white rounded-b-xl shadow-md space-y-3 pt-4">
              <CardDescription>Creator performance and demographics</CardDescription>
              <p className="text-muted-foreground"> Creator analytics coming soon. Understand your creator
            audience and top performers.</p>
            </CardContent>
          </div>
        </TabPanel>
      </TabContent>
    </div>
  );
}
