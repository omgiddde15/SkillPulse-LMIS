import React, { useState, useEffect, useCallback } from 'react';
import { AuthContext } from './AuthContext';
import {
  fetchCurrentUser,
  loginUser,
  registerUser,
  logoutUser,
  setStoredSessionToken,
  onUnauthorized,
} from '../api/client';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isDemo, setIsDemo] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Restore session only after successful server validation
  const checkAuth = useCallback(async () => {
    try {
      const res = await fetchCurrentUser();
      if (res && res.authenticated && res.user) {
        setUser(res.user);
        setIsDemo(false);
      } else {
        setUser(null);
        setStoredSessionToken(null);
      }
    } catch {
      setUser(null);
      setStoredSessionToken(null);
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Synchronize expired or invalid sessions when a protected request is rejected (HTTP 401)
  useEffect(() => {
    const unsubscribe = onUnauthorized(() => {
      setUser(null);
      setIsDemo(false);
    });
    return unsubscribe;
  }, []);

  const login = useCallback(async (credentials) => {
    setAuthError(null);
    const res = await loginUser(credentials);
    if (res && res.user) {
      if (res.token || res.session_id) {
        setStoredSessionToken(res.token || res.session_id);
      }
      setUser(res.user);
      setIsDemo(false);
      return res.user;
    }
    throw new Error('Authentication response did not return a user profile.');
  }, []);

  const register = useCallback(async (formData) => {
    setAuthError(null);
    const res = await registerUser(formData);
    if (res && res.user) {
      if (res.token || res.session_id) {
        setStoredSessionToken(res.token || res.session_id);
      }
      setUser(res.user);
      setIsDemo(false);
      return res.user;
    }
    throw new Error('Registration response did not return a user profile.');
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutUser();
    } finally {
      setStoredSessionToken(null);
      setUser(null);
      setIsDemo(false);
      setAuthError(null);
    }
  }, []);

  const enterDemo = useCallback(() => {
    setIsDemo(true);
  }, []);

  const value = {
    user,
    isAuthenticated: Boolean(user),
    isDemo,
    isLoadingAuth,
    authError,
    setAuthError,
    login,
    register,
    logout,
    enterDemo,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
