export const setToken = (token: string) => {
  localStorage.setItem('auth_token', token);
};

export const getToken = (): string | null => {
  return localStorage.getItem('auth_token');
};

export const removeToken = () => {
  localStorage.removeItem('auth_token');
};

export const setUser = (user: any) => {
  localStorage.setItem('auth_user', JSON.stringify(user));
};

export const getUser = (): any | null => {
  const userStr = localStorage.getItem('auth_user');
  if (userStr) {
    try {
      return JSON.parse(userStr);
    } catch (e) {
      return null;
    }
  }
  return null;
};

export const removeUser = () => {
  localStorage.removeItem('auth_user');
};
