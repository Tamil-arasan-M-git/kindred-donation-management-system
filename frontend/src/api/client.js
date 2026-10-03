import { cacheGet, cacheSet, clearCurrentUserCache, getSyncMetadata, setSyncMetadata } from "../cache/indexedDb";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const readResponse = async (response) => {
  const contentType = response.headers.get("content-type") || "";

  if (response.status === 204) {
    return null;
  }

  if (contentType.includes("application/json")) {
    return response.json().catch(() => null);
  }

  return response.text().catch(() => null);
};

const formatErrorMessage = (value) => {
  if (Array.isArray(value)) return value.map(formatErrorMessage).join(", ");
  if (value && typeof value === "object") {
    if (value.msg) return String(value.msg);
    if (value.message) return String(value.message);
    return JSON.stringify(value);
  }
  return String(value);
};

const resourceName = (path) => {
  const normalized = path.split("?")[0].replace(/^\/api\//, "");
  if (normalized.includes("/donations")) return "donations";
  if (normalized.includes("/demands")) return "demands";
  if (normalized.includes("/matches")) return "matches";
  if (normalized.includes("/staff")) return "staff";
  if (normalized.includes("/operations")) return "operations";
  if (normalized.includes("/ngos")) return "ngos";
  if (normalized.includes("/donors")) return "donors";
  return null;
};

const networkRequest = async (path, options = {}) => {
  const headers = new Headers(options.headers || {});
  const token = localStorage.getItem("kindred_token");

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    body: options.body ?? undefined,
  });

  const payload = await readResponse(response);

  if (!response.ok) {
    const message =
      payload?.detail || payload?.message || payload || "Request failed";
    const error = new Error(formatErrorMessage(message));
    error.status = response.status;
    throw error;
  }

  return payload;
};

const request = async (path, options = {}) => {
  const method = String(options.method || "GET").toUpperCase();
  const resource = resourceName(path);
  if (method !== "GET" || !resource || options.skipCache) {
    return networkRequest(path, options);
  }

  const recordKey = encodeURIComponent(path) || "collection";
  const cached = await cacheGet(resource, recordKey);
  if (cached !== null) {
    if (navigator.onLine) {
      networkRequest(path, options).then(async (fresh) => {
        await cacheSet(resource, fresh, recordKey);
        window.dispatchEvent(new CustomEvent("kindred-cache-updated", { detail: { resource, recordKey } }));
      }).catch(() => {});
    }
    return cached;
  }

  try {
    const fresh = await networkRequest(path, options);
    await cacheSet(resource, fresh, recordKey);
    return fresh;
  } catch (error) {
    const fallback = await cacheGet(resource, recordKey);
    if (fallback !== null) return fallback;
    throw error;
  }
};

export const api = {
  get: (path) => request(path, { method: "GET" }),
  getDonations: (params = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(
        ([, value]) => value !== undefined && value !== null && value !== "",
      ),
    ).toString();
    return request(`/api/donations${query ? `?${query}` : ""}`, {
      method: "GET",
    });
  },
  getDonation: (id) => request(`/api/donations/${id}`, { method: "GET" }),
  getAdminDonationDetail: (id) =>
    request(`/api/donations/${id}`, { method: "GET" }),
  updateDonation: (id, items) =>
    request(`/api/donations/${id}`, {
      method: "PUT",
      body: JSON.stringify({ items }),
    }),
  updateDonationStatus: (id, status, notes = "") =>
    request(`/api/donations/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, notes }),
    }),
  getAdminDonors: (limit = 50, offset = 0) =>
    request(`/api/admin/donors?limit=${limit}&offset=${offset}`, {
      method: "GET",
    }),
  getAdminDashboard: () => request("/api/admin/dashboard", { method: "GET" }),
  setNgoVerification: (ngoId, verified) =>
    request(`/api/ngos/${ngoId}/verification`, {
      method: "PATCH",
      body: JSON.stringify({ verified }),
    }),
  setDonorVerification: (donorId, verified) =>
    request(`/api/admin/donors/${donorId}/verification`, {
      method: "PATCH",
      body: JSON.stringify({ verified }),
    }),
  post: (path, data) =>
    request(path, { method: "POST", body: JSON.stringify(data) }),
  patch: (path, data) =>
    request(path, { method: "PATCH", body: JSON.stringify(data) }),
  put: (path, data) =>
    request(path, { method: "PUT", body: JSON.stringify(data) }),
  del: (path) => request(path, { method: "DELETE" }),
  createDonation: (items) =>
    request("/api/donations", {
      method: "POST",
      body: JSON.stringify({ items }),
    }),
  generateMatches: (donationId) =>
    request(`/api/donations/${donationId}/match`, { method: "POST" }),
  getDonationMatches: (donationId) =>
    request(`/api/donations/${donationId}/matches`, { method: "GET" }),
  getMatch: (matchId) => request(`/api/matches/${matchId}`, { method: "GET" }),
  getNGOMatches: (ngoId, status = "") =>
    request(
      `/api/ngos/${ngoId}/matches${status ? `?status=${encodeURIComponent(status)}` : ""}`,
      { method: "GET" },
    ),
  acceptMatch: (matchId) =>
    request(`/api/matches/${matchId}/accept`, { method: "POST" }),
  rejectMatch: (matchId, reason) =>
    request(
      `/api/matches/${matchId}/reject?reason=${encodeURIComponent(reason || "")}`,
      { method: "POST" },
    ),
  getStatusHistory: (donationId) =>
    request(`/api/donations/${donationId}/status-history`, { method: "GET" }),
  getPackagingChecklist: (donationId) =>
    request(`/api/donations/${donationId}/packaging-checklist`, {
      method: "GET",
    }),
  notifyPackaging: (donationId) =>
    request(`/api/donations/${donationId}/packaging-notify`, {
      method: "POST",
    }),
  getPickup: (donationId) =>
    request(`/api/donations/${donationId}/pickup`, { method: "GET" }),
  cancelDonation: (donationId) =>
    request(`/api/donations/${donationId}/cancel`, { method: "POST" }),
  schedulePickup: (donationId, data) =>
    request(`/api/donations/${donationId}/pickup/schedule`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  reschedulePickup: (donationId, data) =>
    request(`/api/donations/${donationId}/pickup`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  getDonorDashboard: () =>
    request("/api/donors/me/dashboard", { method: "GET" }),
  getNgoDashboard: () => request("/api/ngos/me/dashboard", { method: "GET" }),
  getNotifications: (params = {}) => {
    const unreadOnly =
      typeof params === "boolean"
        ? params
        : (params.unread_only ?? params.unreadOnly);
    return request(
      `/api/notifications${unreadOnly ? "?unread_only=true" : ""}`,
      { method: "GET" },
    );
  },
  markNotificationRead: (notificationId) =>
    request(`/api/notifications/${notificationId}/read`, { method: "PATCH" }),
  markAllNotificationsRead: () =>
    request("/api/notifications/read-all", { method: "PATCH" }),
  getNgoStaff: () => request("/api/ngos/me/staff", { method: "GET" }),
  createNgoStaff: (data) =>
    request("/api/ngos/me/staff", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateNgoStaff: (staffId, data) =>
    request(`/api/ngos/me/staff/${staffId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteNgoStaff: (staffId) =>
    request(`/api/ngos/me/staff/${staffId}`, { method: "DELETE" }),
  permanentlyDeleteNgoStaff: (staffId) =>
    request(`/api/ngos/me/staff/${staffId}/permanent`, { method: "DELETE" }),
  getNgoOperations: (params = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(
        ([, value]) => value !== undefined && value !== null && value !== "",
      ),
    ).toString();
    return request(`/api/ngos/me/operations${query ? `?${query}` : ""}`, {
      method: "GET",
    });
  },
  getTodayNgoOperations: () =>
    request("/api/ngos/me/operations/today", { method: "GET" }),
  getDonationOperations: (donationId) =>
    request(`/api/donations/${donationId}/operations`, { method: "GET" }),
  createDonationOperation: (donationId, data) =>
    request(`/api/donations/${donationId}/operations`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateDonationOperation: (donationId, assignmentId, data) =>
    request(`/api/donations/${donationId}/operations/${assignmentId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  detectImage: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return request("/detect", {
      method: "POST",
      body: formData,
    });
  },
  sync: {
    check: async () => {
      const versions = await getSyncMetadata();
      const query = new URLSearchParams(versions).toString();
      const payload = await networkRequest(`/api/sync/check${query ? `?${query}` : ""}`, { method: "GET", skipCache: true });
      if (payload?.versions) await setSyncMetadata(payload.versions);
      window.dispatchEvent(new CustomEvent("kindred-sync-complete", { detail: payload }));
      return payload;
    },
  },
  clearPrivateCache: clearCurrentUserCache,
};

export default api;
