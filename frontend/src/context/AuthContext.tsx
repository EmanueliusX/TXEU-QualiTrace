import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { authApi } from '../services/api';

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isQualityAdmin: boolean;
  canManageTemplates: boolean;
  canManageUsers: boolean;
  initialized: boolean;
  login: (badge_id: string, pin: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  isAuthenticated: false,
  isAdmin: false,
  isQualityAdmin: false,
  canManageTemplates: false,
  canManageUsers: false,
  initialized: false,
  login: async () => ({} as User),
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('qt_user');
    const token = localStorage.getItem('qt_token');
    if (stored && token) {
      try { setCurrentUser(JSON.parse(stored)); } catch {}
    }
    setInitialized(true);
  }, []);

  const login = async (badge_id: string, pin: string) => {
    const data = await authApi.login(badge_id, pin);
    localStorage.setItem('qt_token', data.token);
    localStorage.setItem('qt_user', JSON.stringify(data.user));
    setCurrentUser(data.user);
    return data.user as User;
  };

  const logout = () => {
    localStorage.removeItem('qt_token');
    localStorage.removeItem('qt_user');
    setCurrentUser(null);
  };

  const isAdmin = currentUser?.role === 'admin';
  const isQualityAdmin = currentUser?.role === 'quality_admin';

  return (
    <AuthContext.Provider value={{
      currentUser,
      isAuthenticated: !!currentUser,
      isAdmin,
      isQualityAdmin,
      canManageTemplates: isAdmin || isQualityAdmin,
      canManageUsers: isAdmin,
      initialized,
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
