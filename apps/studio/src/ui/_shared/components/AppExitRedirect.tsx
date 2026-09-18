import { useEffect } from 'react';

/** Leaves the app for `href`, replacing the history entry. Renders nothing. */
export function AppExitRedirect({ href }: { readonly href: string }) {
  useEffect(() => {
    window.location.replace(href);
  }, [href]);

  return null;
}
