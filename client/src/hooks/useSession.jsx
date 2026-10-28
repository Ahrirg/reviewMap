import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import * as api from '../api/session.js';
import { setAuthErrorHandler } from '../api/client.js';
import { useLocalStorage } from './useLocalStorage.js';

/**
 * Remembers that someone chose to look around without logging in.
 *
 * Guests hold no privileges, so this is a UI preference rather than a session:
 * it only decides whether the login screen appears on the next visit. Logging
 * in is remembered by the server's cookie instead.
 */
const GUEST_KEY = 'reviewmap.guest';

const GUEST = { name: null, role: 'guest' };

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [user, setUser] = useState(GUEST);
  const [status, setStatus] = useState('loading');
  const [guestChoice, setGuestChoice] = useLocalStorage(GUEST_KEY, '');

  // One call on boot decides between the map and the login screen. Rendering
  // the login screen first and correcting it afterwards would flash it at
  // everyone who is already logged in.
  useEffect(() => {
    const controller = new AbortController();
    api
      .fetchSession({ signal: controller.signal })
      .then((session) => {
        setUser({ name: session.name, role: session.role });
        setStatus('ready');
      })
      .catch((err) => {
        // An abort means a newer call is already in flight (StrictMode mounts
        // effects twice in development). Going 'ready' here would flash the
        // login screen at someone who turns out to be logged in.
        if (err?.name === 'AbortError') return;
        setUser(GUEST);
        setStatus('ready');
      });
    return () => controller.abort();
  }, []);

  const signedIn = user.name !== null;

  /**
   * A 401 from anywhere means the cookie stopped resolving: the account was
   * removed, its password changed, or the month ran out. Drop back to the
   * login screen. A 403 only means the role changed, so re-read it quietly.
   */
  useEffect(() => {
    setAuthErrorHandler((httpStatus) => {
      if (httpStatus === 401) {
        setUser(GUEST);
        setGuestChoice('');
        return;
      }
      api
        .fetchSession()
        .then((session) => setUser({ name: session.name, role: session.role }))
        .catch(() => {});
    });
    return () => setAuthErrorHandler(null);
  }, [setGuestChoice]);

  const login = useCallback(
    async (password) => {
      const session = await api.login(password);
      setUser({ name: session.name, role: session.role });
      setGuestChoice('');
      return session;
    },
    [setGuestChoice],
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setUser(GUEST);
      setGuestChoice('');
    }
  }, [setGuestChoice]);

  const continueAsGuest = useCallback(() => setGuestChoice('1'), [setGuestChoice]);

  /** Sends a guest back to the login screen without touching the cookie. */
  const showLogin = useCallback(() => setGuestChoice(''), [setGuestChoice]);

  const value = useMemo(() => {
    const isAdmin = user.role === 'admin';
    return {
      status,
      user,
      signedIn,
      isAdmin,
      // Guests never see a create affordance, and the server refuses them anyway.
      canCreate: user.role === 'reviewer' || isAdmin,
      canDeleteMarker: isAdmin,
      /** Admins delete anything; everyone else only what they wrote themselves. */
      canDeleteReview: (review) =>
        isAdmin || (signedIn && review?.author != null && review.author === user.name),
      needsLogin: status === 'ready' && !signedIn && guestChoice !== '1',
      login,
      logout,
      continueAsGuest,
      showLogin,
    };
  }, [status, user, signedIn, guestChoice, login, logout, continueAsGuest, showLogin]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>');
  return value;
}
