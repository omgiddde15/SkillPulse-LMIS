import React, { useState, useEffect, useCallback } from 'react';
import { AuthContext } from './AuthContext';
import { fetchCurrentUser, loginUser, registerUser, logoutUser } from '../api/client';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isDemo, setIsDemo] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Restore session from server HttpOnly cookie on initial mount or explicit check
  const checkAuth = useCallback(async () => {
    try {
      const res = await fetchCurrentUser();
      if (res && res.authenticated && res.user) {
        setUser(res.user);
        setIsDemo(false);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback(async (credentials) => {
    setAuthError(null);
    const res = await loginUser(credentials);
    if (res && res.user) {
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
