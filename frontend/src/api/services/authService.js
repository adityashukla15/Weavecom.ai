import { apiClient, isApiConfigured } from '../client.js';
import { supabase, supabaseConfigurationError } from '../supabase.js';

function requireSupabase() {
  if (!supabase) {
    throw new Error(supabaseConfigurationError);
  }
  return supabase;
}

export const authService = {
  signUp: (email, password) => requireSupabase().auth.signUp({ email, password }),
  signIn: (email, password) => requireSupabase().auth.signInWithPassword({ email, password }),
  signOut: () => requireSupabase().auth.signOut(),
  clearLocalSession: () => requireSupabase().auth.signOut({ scope: 'local' }),
  getSession: () => requireSupabase().auth.getSession(),
  onAuthStateChange: (callback) => requireSupabase().auth.onAuthStateChange(callback),
  getProfile: () => {
    if (!isApiConfigured) {
      throw new Error('The backend API is not configured. Set VITE_API_BASE_URL.');
    }
    return apiClient.get('/api/v1/auth/me');
  },
};
