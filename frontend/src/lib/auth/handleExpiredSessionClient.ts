import { AUTH_TOKEN_EXPIRED_MESSAGE, AUTH_TOKEN_EXPIRED_STATUS } from './constants';

export function handleExpiredSessionResponse(response: Response) {
  if (response.status !== AUTH_TOKEN_EXPIRED_STATUS) {
    return false;
  }

  if (typeof window !== 'undefined') {
    const currentPath = `${window.location.pathname}${window.location.search}`;
    const next = encodeURIComponent(currentPath || '/admin/listings');
    const target = `/auth/sign-in?reason=expired&next=${next}`;

    if (!window.location.pathname.startsWith('/auth/sign-in')) {
      window.location.replace(target);
    }
  }

  return true;
}

export function sessionExpiredError() {
  return new Error(AUTH_TOKEN_EXPIRED_MESSAGE);
}
