import axios from "axios";
import { useAuthStore } from "../stores/useAuthStore";

// NEXT_PUBLIC_API_URL is the primary target (set this to wherever the
// backend actually is — localhost:5000 for local dev, your Render URL in
// production). NEXT_PUBLIC_API_EXTERNAL_URL is kept as a fallback only —
// previously it was defined in .env.local but never read anywhere, so a
// deployed frontend would silently keep hitting localhost:5000 and every
// request (including login) would fail with a network error.
const resolvedBaseURL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_EXTERNAL_URL ||
  "http://localhost:5000/api";

if (process.env.NODE_ENV !== "production" && !process.env.NEXT_PUBLIC_API_URL) {
  // eslint-disable-next-line no-console
  console.warn(
    `[axios] NEXT_PUBLIC_API_URL is not set — falling back to ${resolvedBaseURL}. ` +
      `Set it in .env.local to avoid pointing at the wrong backend.`
  );
}

const api = axios.create({
  baseURL: resolvedBaseURL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let queue = [];

const processQueue = (error, token = null) => {
  queue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  queue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;

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
        const response = await api.post("/auth/refresh");
        const accessToken = response.data.data.accessToken;
        useAuthStore.getState().setAccessToken(accessToken);
        processQueue(null, accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
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

/**
 * The /nodes/:id/download route requires a Bearer token, which plain
 * <img>/<iframe> tags can't send. This fetches the file through axios (so
 * the auth interceptor above attaches the header) and converts it to a
 * base64 `data:` URL — not a blob object URL, because PdfViewer manually
 * parses and re-encodes the data URL's bytes (see dataUrlToBytes there),
 * which only works on an actual data: URL, not a blob: reference.
 */
export async function fetchFileDataUrl(nodeId) {
  const response = await api.get(`/nodes/${nodeId}/download`, { responseType: "blob" });
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(response.data);
  });
}

/**
 * Same authenticated download route as fetchFileDataUrl, but for text
 * files (.html, .jsx, etc.) where CodePreview needs the raw source —
 * fetching straight as text avoids an unnecessary blob -> base64 ->
 * fetch()->text() round trip.
 */
export async function fetchFileText(nodeId) {
  const response = await api.get(`/nodes/${nodeId}/download`, { responseType: "text" });
  return response.data;
}

/**
 * Triggers a real browser "Save As" download for a single node (file or
 * folder — folders come back zipped from the backend) or a multi-select
 * batch (via `/nodes/download?ids=`). Reads the real filename off
 * Content-Disposition when the server sent one (see app.js's
 * `exposedHeaders`), falling back to `fallbackName` if not.
 */
async function saveBlobResponse(response, fallbackName) {
  const disposition = response.headers["content-disposition"];
  let filename = fallbackName || "download";
  if (disposition) {
    const starMatch = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
    const plainMatch = /filename="([^"]+)"/i.exec(disposition);
    if (starMatch) filename = decodeURIComponent(starMatch[1]);
    else if (plainMatch) filename = plainMatch[1];
  }

  const url = window.URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the download a tick to actually start before revoking the
  // object URL, then release the memory.
  setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}

export async function downloadNode(nodeId, fallbackName) {
  const response = await api.get(`/nodes/${nodeId}/download`, { responseType: "blob" });
  await saveBlobResponse(response, fallbackName);
}

export async function downloadNodes(nodeIds, fallbackName = "download.zip") {
  const response = await api.get(`/nodes/download`, {
    params: { ids: nodeIds.join(",") },
    responseType: "blob",
  });
  await saveBlobResponse(response, fallbackName);
}

export default api;