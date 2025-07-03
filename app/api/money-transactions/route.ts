import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse pagination parameters
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '25', 10);
    const type = searchParams.get('type'); // Optional filter by transaction type
    const status = searchParams.get('status'); // Optional filter by transaction status
    
    // Validate pagination parameters
    if (page < 1) {
      return NextResponse.json(
        { error: 'Page must be greater than 0' },
        { status: 400 }
      );
    }
    
    if (limit < 1 || limit > 200) {
      return NextResponse.json(
        { error: 'Limit must be between 1 and 200' },
        { status: 400 }
      );
    }
    
    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Calculate offset for pagination
    const offset = (page - 1) * limit;
    
    // Build query with filters
    let query = supabase
      .from('money_transactions')
      .select('id, created_at, description, amount, status, type, remarks', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    // Apply optional filters
    if (type) {
      query = query.eq('type', type);
    }
    
    if (status) {
      query = query.eq('status', status);
    }
    
    // Apply pagination
    query = query.range(offset, offset + limit - 1);
    
    const { data: transactions, error: fetchError, count } = await query;
    
    if (fetchError) {
      console.error('Error fetching money transactions:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch transactions' },
        { status: 500 }
      );
    }
    
    // Calculate pagination metadata
    const totalPages = Math.ceil((count || 0) / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;
    
    return NextResponse.json({
      success: true,
      data: {
        transactions: transactions || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages,
          hasNextPage,
          hasPreviousPage
        },
        filters: {
          type,
          status
        }
      }
    });
    
  } catch (error) {
    console.error('Error in money transactions API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 