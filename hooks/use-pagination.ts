import { useState, useEffect, useCallback, useRef } from 'react';

interface PaginationState {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface UsePaginationOptions {
  initialPage?: number;
  initialLimit?: number;
  apiEndpoint: string;
  filters?: Record<string, string | null>;
}

interface PaginationResponse<T> {
  success: boolean;
  data: {
    transactions: T[];
    pagination: PaginationState;
    filters?: Record<string, string | null>;
  };
}

export function usePagination<T>({
  initialPage = 1,
  initialLimit = 25,
  apiEndpoint,
  filters = {},
}: UsePaginationOptions) {
  const [data, setData] = useState<T[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    page: initialPage,
    limit: initialLimit,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Use refs to avoid infinite loops
  const filtersRef = useRef(filters);
  const apiEndpointRef = useRef(apiEndpoint);
  const paginationRef = useRef(pagination);
  
  // Update refs when values change
  filtersRef.current = filters;
  apiEndpointRef.current = apiEndpoint;
  paginationRef.current = pagination;

  const fetchData = useCallback(async (page: number, limit: number) => {
    setLoading(true);
    setError(null);

    try {
      const searchParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...Object.fromEntries(
          Object.entries(filtersRef.current).filter(([_, value]) => value !== null && value !== '')
        ),
      });

      const response = await fetch(`${apiEndpointRef.current}?${searchParams}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: PaginationResponse<T> = await response.json();
      
      if (!result.success) {
        throw new Error('API returned error');
      }

      setData(result.data.transactions);
      setPagination(result.data.pagination);
    } catch (err) {
      console.error('Error fetching paginated data:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setData([]);
      setPagination(prev => ({ ...prev, total: 0, totalPages: 0 }));
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependencies to prevent infinite loops

  // Initial load only
  useEffect(() => {
    fetchData(initialPage, initialLimit);
  }, []); // Only run once on mount

  const setPage = useCallback((newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
    fetchData(newPage, paginationRef.current.limit);
  }, [fetchData]);

  const setLimit = useCallback((newLimit: number) => {
    setPagination(prev => ({ ...prev, page: 1, limit: newLimit }));
    fetchData(1, newLimit); // Reset to page 1 when changing limit
  }, [fetchData]);

  const refresh = useCallback(() => {
    fetchData(paginationRef.current.page, paginationRef.current.limit);
  }, [fetchData]);

  return {
    data,
    pagination,
    loading,
    error,
    setPage,
    setLimit,
    refresh,
  };
} 