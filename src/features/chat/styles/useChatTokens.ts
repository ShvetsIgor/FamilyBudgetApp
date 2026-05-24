import { useAppSelector } from '@/store/store';
import { C_LIGHT, C_DARK } from './tokens';

/**
 * Returns the correct color token set based on the current app theme.
 * Use this in every React component instead of importing the static `C`.
 */
export function useChatTokens() {
  const theme = useAppSelector((s) => s.ui.theme);
  return theme === 'dark' ? C_DARK : C_LIGHT;
}
