import { create } from "zustand";
import api from "../lib/axios";

// Server is the authoritative source of lockout truth (see backend
// auth.service.js) — this constant only drives the local "N attempts
// remaining" hint in LoginPage before the server has weighed in at all.
export const MAX_ATTEMPTS = 5;

export const useAuthStore = create((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,

  // Local-only UX counters. Never trusted for actually gating a request —
  // every login attempt still goes to the server, which enforces the real
  // lockout regardless of what this counter says.
  failedAttempts: 0,
  lockedUntil: null,

  setAccessToken: (accessToken) => set({ accessToken, isAuthenticated: !!accessToken }),
  setUser: (user) => set({ user }),

  login: async ({ email, password }) => {
    const { lockedUntil } = get();
    if (lockedUntil && Date.now() < lockedUntil) {
      const secondsLeft = Math.ceil((lockedUntil - Date.now()) / 1000);
      throw new Error(`Too many attempts. Try again in ${secondsLeft}s.`);
    }

    try {
      const { data } = await api.post("/auth/login", { email, password });
      const { user, accessToken } = data.data;

      set({
        user,
        accessToken,
        isAuthenticated: true,
        failedAttempts: 0,
        lockedUntil: null,
      });

      return { user, accessToken };
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.message || "Invalid email or password";

      if (status === 429) {
        // Server has already locked the account — mirror that locally so
        // the UI doesn't let the person hammer the button in the meantime.
        // The 30s here is just a local cosmetic re-enable; the real gate
        // (LOCKOUT_DURATION_MINUTES) is enforced server-side regardless.
        set({ lockedUntil: Date.now() + 30_000 });
      } else {
        set((s) => ({ failedAttempts: s.failedAttempts + 1 }));
      }

      throw new Error(message);
    }
  },

  register: async ({ name, email, password }) => {
    try {
      const { data } = await api.post("/auth/register", { name, email, password });
      const { user, accessToken } = data.data;

      set({
        user,
        accessToken,
        isAuthenticated: true,
        failedAttempts: 0,
        lockedUntil: null,
      });

      return { user, accessToken };
    } catch (err) {
      // Zod validation errors arrive as data.errors: [{ field, message }]
      // (see error.middleware.js) — surface the first one if present, since
      // it's usually the most actionable (e.g. "Password must contain at
      // least one letter and one number" beats a generic "Validation failed").
      const fieldErrors = err.response?.data?.errors;
      const message =
        fieldErrors?.[0]?.message || err.response?.data?.message || "Could not create account";
      throw new Error(message);
    }
  },

  logout: async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Even if the network call fails (e.g. already-expired session),
      // still clear local state — a stuck "logged in" UI is worse than a
      // refresh token that quietly expires server-side on its own.
    } finally {
      set({ user: null, accessToken: null, isAuthenticated: false });
    }
  },

  updateProfile: async ({ name }) => {
    const { data } = await api.patch("/auth/profile", { name });
    set({ user: data.data.user });
    return data.data.user;
  },

  changePassword: async (currentPassword, newPassword) => {
    await api.post("/auth/change-password", { currentPassword, newPassword });
    // Backend revokes every session (including this one) on password
    // change, so the refresh cookie is now dead — force a clean re-login
    // instead of leaving the UI in a half-authenticated state.
    set({ user: null, accessToken: null, isAuthenticated: false });
  },

  // Called once on app boot (see Providers). Tries to silently restore a
  // session from the httpOnly refresh cookie — if there's a valid one,
  // the person never sees the login screen at all.
  initializeAuth: async () => {
    try {
      const { data } = await api.post("/auth/refresh");
      const { accessToken, user } = data.data;
      // Set the access token first — /auth/me needs it in the
      // Authorization header, which the axios interceptor reads straight
      // from this store's state at request time.
      set({ accessToken, isAuthenticated: true });

      const meResponse = await api.get("/auth/me");
      set({ user: meResponse.data.data.user ?? user });
    } catch {
      set({ user: null, accessToken: null, isAuthenticated: false });
    } finally {
      set({ isLoading: false });
    }
  },
}));