import { C_THEME } from './tokens';

/**
 * Returns the correct color token set based on the current app theme.
 * Use this in every React component instead of importing the static `C`.
 */
export function useChatTokens() {
  return C_THEME;
}
