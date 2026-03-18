import { useQuery, UseQueryOptions, QueryKey } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { getApiErrorMessage } from './apiMessages';
import type { SnackbarHandler } from './useApiMutation';

export interface UseApiQueryOptions<TQueryFnData = unknown, TError = unknown>
  extends Omit<UseQueryOptions<TQueryFnData, TError>, 'queryKey' | 'queryFn'> {
  queryKey: QueryKey;
  queryFn: UseQueryOptions<TQueryFnData, TError>['queryFn'];
  /** If provided, on first query failure the error message is passed here. */
  onMessage?: SnackbarHandler;
  errorMessage?: string;
}

/** useQuery wrapper; optionally calls onMessage once when the query fails. */
export function useApiQuery<TQueryFnData = unknown, TError = unknown>(
  options: UseApiQueryOptions<TQueryFnData, TError>,
) {
  const { queryKey, queryFn, onMessage, errorMessage = 'Failed to load data', ...rest } = options;
  const query = useQuery({ queryKey, queryFn, ...rest });
  const lastErrorRef = useRef<unknown>(undefined);

  useEffect(() => {
    if (!query.isError || !onMessage || query.error === lastErrorRef.current) return;
    lastErrorRef.current = query.error;
    onMessage(getApiErrorMessage(query.error, errorMessage), 'error');
  }, [query.isError, query.error, onMessage, errorMessage]);

  return query;
}
