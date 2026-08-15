import { create } from "zustand";
import api from "../lib/axios";

// Shared, multi-user board — deliberately NOT persisted client-side like
// tasks/snippets are. Every user needs to see the same wall, so this is
// backend-backed (/api/community) instead of localStorage.
export const useCommunityStore = create((set, get) => ({
  posts: [],
  nextCursor: null,
  isLoading: false,
  isPosting: false,
  error: null,
  // ids that were added in THIS session, so the UI can play the
  // drop-in/pin animation only for genuinely new cards, not every card on
  // every refetch.
  freshIds: new Set(),

  fetchPosts: async ({ append = false } = {}) => {
    set({ isLoading: true, error: null });
    try {
      const cursor = append ? get().nextCursor : undefined;
      const { data } = await api.get("/community", {
        params: cursor ? { cursor, limit: 30 } : { limit: 30 },
      });
      const { items, nextCursor } = data.data;
      set((s) => ({
        posts: append ? [...s.posts, ...items] : items,
        nextCursor,
        isLoading: false,
      }));
    } catch (err) {
      set({
        isLoading: false,
        error: err.response?.data?.message || "Couldn't load the wall. Try again.",
      });
    }
  },

  loadMore: () => {
    if (!get().nextCursor || get().isLoading) return;
    return get().fetchPosts({ append: true });
  },

  addPost: async (name, message) => {
    const trimmedName = name.trim();
    const trimmedMessage = message.trim();
    if (!trimmedName || !trimmedMessage) return { ok: false, error: "Name and message are both required" };

    set({ isPosting: true, error: null });
    try {
      const { data } = await api.post("/community", { name: trimmedName, message: trimmedMessage });
      const post = data.data.post;
      set((s) => ({
        posts: [post, ...s.posts],
        isPosting: false,
        freshIds: new Set(s.freshIds).add(post.id),
      }));
      // Clear the "fresh" flag after the drop-in animation has had time
      // to play, so it doesn't replay if the list re-renders later.
      setTimeout(() => {
        set((s) => {
          const next = new Set(s.freshIds);
          next.delete(post.id);
          return { freshIds: next };
        });
      }, 1200);
      return { ok: true, post };
    } catch (err) {
      const message = err.response?.data?.errors?.[0]?.message || err.response?.data?.message || "Couldn't post that — try again.";
      set({ isPosting: false, error: message });
      return { ok: false, error: message };
    }
  },

  removePost: async (id) => {
    const prevPosts = get().posts;
    // Optimistic — feels instant, rolled back on failure.
    set((s) => ({ posts: s.posts.filter((p) => p.id !== id) }));
    try {
      await api.delete(`/community/${id}`);
      return { ok: true };
    } catch (err) {
      set({ posts: prevPosts });
      return { ok: false, error: err.response?.data?.message || "Couldn't remove that post" };
    }
  },
}));
