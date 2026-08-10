import axios from "axios";
import { useAuthStore } from "../stores/useAuthStore";

const api = axios.create({
  baseURL:
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api",
  withCredentials: true,
});

/* -------------------------------------------------------------------------- */
/*                                  REQUEST                                   */
/* -------------------------------------------------------------------------- */

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;

  console.log("[REQUEST]", config.url);
  console.log("[TOKEN]", token ? "present" : "missing");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

let isRefreshing = false;
let queue = [];

const processQueue = (error, token = null) => {
  queue.forEach((p) => {
    if (error) {
      p.reject(error);
    } else {
      p.resolve(token);
    }
  });

  queue = [];
};

/* -------------------------------------------------------------------------- */
/*                                  RESPONSE                                  */
/* -------------------------------------------------------------------------- */

api.interceptors.response.use(
  (response) => response,

  async (error) => {
    console.error("[API ERROR]", {
      url: error.config?.url,
      status: error.response?.status,
      data: error.response?.data,
    });

    const originalRequest = error.config;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    const isAuthRoute =
      originalRequest.url?.includes("/auth/login") ||
      originalRequest.url?.includes("/auth/register") ||
      originalRequest.url?.includes("/auth/refresh");

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isAuthRoute
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          queue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        console.log("[AUTH] Refreshing token...");

        const response = await api.post("/auth/refresh");

        const accessToken = response.data.data.accessToken;

        useAuthStore.getState().setAccessToken(accessToken);

        processQueue(null, accessToken);

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;

        return api(originalRequest);
      } catch (refreshError) {
        console.error("[AUTH] Refresh failed", refreshError);

        processQueue(refreshError, null);

        useAuthStore.setState({
          user: null,
          accessToken: null,
          isAuthenticated: false,
        });

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

/* -------------------------------------------------------------------------- */
/*                                   FILES                                    */
/* -------------------------------------------------------------------------- */

export async function fetchFileDataUrl(nodeId) {
  const response = await api.get(`/nodes/${nodeId}/download`, {
    responseType: "blob",
  });

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;

    reader.readAsDataURL(response.data);
  });
}

export async function fetchFileText(nodeId) {
  const response = await api.get(`/nodes/${nodeId}/download`, {
    responseType: "text",
  });

  console.log("[HTML FILE]", response);

  return response.data;
}

export default api;