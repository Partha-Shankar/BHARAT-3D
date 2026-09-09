import { create } from 'zustand';
import { User } from '../types';
import { getToken, getUser, setToken, setUser, removeToken, removeUser } from '../lib/auth';
import api from '../lib/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<void>;
  logout: () => void;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: getUser(),
  token: getToken(),
  isAuthenticated: !!getToken(),
  isLoading: false,

  login: async (email: string, password = 'demo2026') => {
    set({ isLoading: true });
    try {
      const response = await api.post('/auth/login', { email, password });
      const { access_token, user } = response.data;
      setToken(access_token);
      setUser(user);
      set({ user, token: access_token, isAuthenticated: true, isLoading: false });
    } catch (error) {
      // Demo fallback in case backend is offline
      let role = 'SURVEYOR';
      let fullName = 'Rajesh Kumar (Surveyor)';
      if (email.includes('municipality')) {
        role = 'MUNICIPALITY';
        fullName = 'Sanjay Verma (Municipal Officer)';
      } else if (email.includes('utility')) {
        role = 'UTILITY_OPERATOR';
        fullName = 'Vikram Malhotra (Utility Contractor)';
      } else if (email.includes('citizen')) {
        role = 'CITIZEN';
        fullName = 'Priya Mehta (Property Owner)';
      }

      const mockUser: User = {
        id: 'usr-demo-01',
        email,
        full_name: fullName,
        role: role as any,
      };

      setToken('mock_jwt_token_' + role);
      setUser(mockUser);
      set({ user: mockUser, token: 'mock_jwt_token_' + role, isAuthenticated: true, isLoading: false });
    }
  },

  logout: () => {
    removeToken();
    removeUser();
    set({ user: null, token: null, isAuthenticated: false, isLoading: false });
  },

  initialize: () => {
    const token = getToken();
    const user = getUser();
    if (token && user) {
      set({ user, token, isAuthenticated: true });
    } else {
      set({ user: null, token: null, isAuthenticated: false });
    }
  },
}));
