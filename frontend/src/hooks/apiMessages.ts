/** Extract user-facing error message from API errors (e.g. Axios) or Error instances. */
export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const r = (err as { response?: { data?: { message?: string } } }).response;
    const msg = r?.data?.message;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  if (err instanceof Error && typeof err.message === 'string' && err.message.trim()) {
    return err.message;
  }
  return fallback;
}
