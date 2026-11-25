import { useEffect } from 'react';

const APP_TITLE = 'WorkBalance';

export function useDocumentTitle(pageTitle) {
  useEffect(() => {
    if (pageTitle === null || pageTitle === undefined) {
      return undefined;
    }
    const cleaned = typeof pageTitle === 'string' ? pageTitle.trim() : '';
    const nextTitle = cleaned ? `${cleaned} | ${APP_TITLE}` : APP_TITLE;
    document.title = nextTitle;

    return () => {
      if (document.title === nextTitle) {
        document.title = APP_TITLE;
      }
    };
  }, [pageTitle]);
}
