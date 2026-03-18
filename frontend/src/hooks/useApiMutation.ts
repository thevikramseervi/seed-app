import {
  useMutation,
  useQueryClient,
  UseMutationOptions,
  MutationFunction,
} from '@tanstack/react-query';
import { getApiErrorMessage } from './apiMessages';

export type SnackbarHandler = (message: string, severity: 'success' | 'error') => void;

export interface UseApiMutationOptions<TData, TError, TVariables> {
  mutationFn: MutationFunction<TData, TVariables>;
  /** Show this message on success (or function of response). When set, onMessage is used if provided. */
  successMessage?: string | ((data: TData) => string);
  /** Fallback error message when request fails. When set, onMessage is used if provided. */
  errorMessage?: string;
  /** Query keys to invalidate on success (each key is an array, e.g. ['users']). */
  invalidateKeys?: unknown[][];
  /** If provided, success/error messages are passed here (e.g. snackbar). */
  onMessage?: SnackbarHandler;
  onSuccess?: (data: TData, variables: TVariables, context: unknown) => void;
  onError?: (error: TError, variables: TVariables, context: unknown) => void;
}

/**
 * useMutation wrapper that optionally shows success/error via onMessage and invalidates queries.
 */
export function useApiMutation<TData = unknown, TError = unknown, TVariables = void>(
  options: UseApiMutationOptions<TData, TError, TVariables>,
) {
  const {
    mutationFn,
    successMessage,
    errorMessage = 'Something went wrong',
    invalidateKeys,
    onMessage,
    onSuccess,
    onError,
  } = options;

  const queryClient = useQueryClient();

  const mutationOptions: UseMutationOptions<TData, TError, TVariables> = {
    mutationFn,
    onSuccess: (data, variables, context) => {
      if (invalidateKeys?.length) {
        invalidateKeys.forEach((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        );
      }
      if (onMessage && successMessage !== undefined) {
        const msg =
          typeof successMessage === 'function'
            ? successMessage(data)
            : successMessage;
        onMessage(msg, 'success');
      }
      onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      if (onMessage) {
        onMessage(getApiErrorMessage(error, errorMessage), 'error');
      }
      onError?.(error, variables, context);
    },
  };

  return useMutation<TData, TError, TVariables>(mutationOptions);
}
