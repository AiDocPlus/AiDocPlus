export function beginLoadingState(): { isLoading: true; error: null } {
  return {
    isLoading: true,
    error: null,
  };
}

export function finishLoadingState<T extends object = Record<string, never>>(
  extra?: T,
): T & { isLoading: false } {
  return {
    ...(extra ?? ({} as T)),
    isLoading: false,
  };
}

export function resolveAsyncErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function errorState(error: unknown, fallback: string): { error: string } {
  return {
    error: resolveAsyncErrorMessage(error, fallback),
  };
}

export function finishWithErrorState(error: unknown, fallback: string): { isLoading: false; error: string } {
  return {
    isLoading: false,
    error: resolveAsyncErrorMessage(error, fallback),
  };
}
