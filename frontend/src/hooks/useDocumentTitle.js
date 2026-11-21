import { useEffect } from 'react';

const APP_TITLE = 'WorkBalance';

export function useDocumentTitle(pageTitle) {
  useEffect(() => {
    const cleaned = typeof pageTitle === 'string' ? pageTitle.trim() : '';
    document.title = cleaned ? `${cleaned} | ${APP_TITLE}` : APP_TITLE;

    return () => {
      document.title = APP_TITLE;
    };
  }, [pageTitle]);
}
