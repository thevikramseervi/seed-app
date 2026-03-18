import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      // Retry up to 4 times with an 8-second delay between attempts.
      // This gives the Render free-tier backend ~40s to wake up from a cold start.
      retry: 4,
      retryDelay: 8000,
    },
  },
});

