import { router } from 'expo-router';

/**
 * Back if there's somewhere to go back to; otherwise (screen opened directly
 * from a link or notification) go to Today instead of doing nothing.
 */
export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
