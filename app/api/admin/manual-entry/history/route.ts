import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    // Verify admin access
    const { isAdmin, error: adminError } = await verifyAdminAccess();
    if (!isAdmin) {
      return NextResponse.json(
        { error: adminError || "Admin access required" },
        { status: 403 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const filterType = searchParams.get("type");
    const filterCategory = searchParams.get("category");

    const supabase = createAdminClient();

    // Fetch ALL coin transactions for statistics (not paginated)
    let allCoinTransactions = null;
    let allCoinError = null;

    if ((!filterType || filterType === "coins") && !filterCategory) {
      const allResult = await supabase
        .from("coin_transactions")
        .select(
          `
        id,
        user_id,
        type,
        coins,
        description,
        created_at
      `
        )
        .eq("type", "bonus");

      allCoinTransactions = allResult.data;
      allCoinError = allResult.error;
    }

    if (allCoinError) {
      console.error("Error fetching all coin transactions:", allCoinError);
    }

    // Fetch ALL money transactions for statistics (not paginated)
    let allMoneyTransactions = null;
    let allMoneyError = null;

    if (!filterType || filterType === "cash" || filterCategory) {
      let allQuery = supabase
        .from("money_transactions")
        .select(
          `
        id,
        user_id,
        type,
        amount,
        currency,
        description,
        remarks,
        metadata,
        created_at
      `
        )
        .eq("type", "reward")
        .eq("metadata->>manual_entry", "true");

      // Apply category filter if specified
      if (filterCategory) {
        allQuery = allQuery.eq("metadata->>category", filterCategory);
      }

      const allResult = await allQuery.order("created_at", {
        ascending: false,
      });

      allMoneyTransactions = allResult.data;
      allMoneyError = allResult.error;
    }

    if (allMoneyError) {
      console.error("Error fetching all money transactions:", allMoneyError);
    }

    // Calculate statistics from all transactions
    const totalCoins = (allCoinTransactions || []).reduce(
      (sum, tx: any) => sum + (tx.coins || 0),
      0
    );
    const totalMoneySpent = (allMoneyTransactions || []).reduce(
      (sum, tx: any) => sum + (tx.amount || 0),
      0
    );
    const totalTransactions =
      (allCoinTransactions?.length || 0) + (allMoneyTransactions?.length || 0);
    const totalUniqueUsers = new Set([
      ...(allCoinTransactions || []).map((tx: any) => tx.user_id),
      ...(allMoneyTransactions || []).map((tx: any) => tx.user_id),
    ]).size;

    // Get total counts for pagination
    let totalCoinCount = 0;
    let totalMoneyCount = 0;

    if ((!filterType || filterType === "coins") && !filterCategory) {
      const { count } = await supabase
        .from("coin_transactions")
        .select("*", { count: "exact", head: true })
        .eq("type", "bonus");
      totalCoinCount = count || 0;
    }

    if (!filterType || filterType === "cash" || filterCategory) {
      let countQuery = supabase
        .from("money_transactions")
        .select("*", { count: "exact", head: true })
        .eq("type", "reward")
        .eq("metadata->>manual_entry", "true");

      if (filterCategory) {
        countQuery = countQuery.eq("metadata->>category", filterCategory);
      }

      const { count } = await countQuery;
      totalMoneyCount = count || 0;
    }

    const totalCount = totalCoinCount + totalMoneyCount;

    // Fetch paginated coin transactions with admin manual entries
    let coinTransactions = null;
    let coinError = null;

    // When filterType is "all", we need to fetch more transactions to properly paginate
    // the combined result. Fetch enough to cover the current page range.
    const fetchLimit =
      !filterType || filterType === "all" ? offset + limit : limit;
    const fetchOffset = !filterType || filterType === "all" ? 0 : offset;

    if ((!filterType || filterType === "coins") && !filterCategory) {
      const result = await supabase
        .from("coin_transactions")
        .select(
          `
        id,
        user_id,
        type,
        coins,
        description,
        created_at
      `
        )
        .eq("type", "bonus")
        .order("created_at", { ascending: false })
        .range(fetchOffset, fetchOffset + fetchLimit - 1);

      coinTransactions = result.data;
      coinError = result.error;
    }

    if (coinError) {
      console.error("Error fetching coin transactions:", coinError);
    }

    // Fetch paginated money transactions with admin manual entries
    // Fetch if:
    // 1. No type filter and no category filter (show all)
    // 2. Type filter is "cash"
    // 3. Category filter is set (categories only apply to cash, so implicitly filter by cash)
    let moneyTransactions = null;
    let moneyError = null;

    if (!filterType || filterType === "cash" || filterCategory) {
      let query = supabase
        .from("money_transactions")
        .select(
          `
        id,
        user_id,
        type,
        amount,
        currency,
        description,
        remarks,
        metadata,
        created_at
      `
        )
        .eq("type", "reward")
        .eq("metadata->>manual_entry", "true");

      // Apply category filter if specified
      if (filterCategory) {
        query = query.eq("metadata->>category", filterCategory);
      }

      const result = await query
        .order("created_at", { ascending: false })
        .range(fetchOffset, fetchOffset + fetchLimit - 1);

      moneyTransactions = result.data;
      moneyError = result.error;
    }

    if (moneyError) {
      console.error("Error fetching money transactions:", moneyError);
    }

    // Get unique user IDs
    const userIds = [
      ...new Set([
        ...(coinTransactions || []).map((tx: any) => tx.user_id),
        ...(moneyTransactions || []).map((tx: any) => tx.user_id),
      ]),
    ];

    // Fetch user details
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, email, full_name, username")
      .in("id", userIds);

    if (usersError) {
      console.error("Error fetching users:", usersError);
    }

    // Create user map
    const userMap = new Map((users || []).map((user: any) => [user.id, user]));

    // Combine and format transactions
    let allTransactions = [
      ...(coinTransactions || []).map((tx: any) => {
        const user = userMap.get(tx.user_id);
        return {
          id: tx.id,
          userId: tx.user_id,
          userEmail: user?.email || "Unknown",
          userName: user?.full_name || user?.username || "Unknown",
          userUsername: user?.username || null,
          transactionType: "coins" as const,
          amount: tx.coins,
          amountFormatted: `${tx.coins} coins`,
          category: null,
          description: tx.description,
          createdAt: tx.created_at,
        };
      }),
      ...(moneyTransactions || []).map((tx: any) => {
        const user = userMap.get(tx.user_id);
        return {
          id: tx.id,
          userId: tx.user_id,
          userEmail: user?.email || "Unknown",
          userName: user?.full_name || user?.username || "Unknown",
          userUsername: user?.username || null,
          transactionType: "cash" as const,
          amount: tx.amount, // in cents
          amountFormatted: `$${(tx.amount / 100).toFixed(2)}`,
          category: tx.metadata?.category || null,
          description: tx.description,
          createdAt: tx.created_at,
        };
      }),
    ].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Apply pagination slice if filterType is "all" (we fetched more than needed)
    if (!filterType || filterType === "all") {
      allTransactions = allTransactions.slice(offset, offset + limit);
    }

    return NextResponse.json({
      success: true,
      transactions: allTransactions,
      total: totalCount,
      statistics: {
        totalCoins,
        totalMoneySpent, // in cents
        totalTransactions,
        totalUniqueUsers,
      },
    });
  } catch (error) {
    console.error("Error fetching manual entry history:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
