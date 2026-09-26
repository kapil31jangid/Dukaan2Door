import { apiRequest, setToken, removeToken } from './api';
import { LoginPayload, RegisterPayload, TokenResponse, UserMeResponse } from '../types/auth';

export const authService = {
  async login(payload: LoginPayload): Promise<TokenResponse> {
    const res = await apiRequest<TokenResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setToken(res.access_token);
    return res;
  },

  async register(payload: RegisterPayload): Promise<TokenResponse> {
    const res = await apiRequest<TokenResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setToken(res.access_token);
    return res;
  },

  async getMe(): Promise<UserMeResponse> {
    return apiRequest<UserMeResponse>('/api/auth/me');
  },

  logout(): void {
    removeToken();
  },
};

