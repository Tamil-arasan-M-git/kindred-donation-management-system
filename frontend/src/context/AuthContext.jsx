import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "../api/client";

const AuthContext = createContext(null);

const normalizeUser = (payload) => {
  if (!payload) return null;

  const user = payload.user ?? payload;

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    donor_id: user.donor_id ?? null,
    ngo_id: user.ngo_id ?? null,
  };
};

const getStoredUser = () => {
  const raw = localStorage.getItem("kindred_user");
  if (!raw) return null;

  try {
    return normalizeUser(JSON.parse(raw));
  } catch {
    localStorage.removeItem("kindred_user");
    return null;
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      const token = localStorage.getItem("kindred_token");

      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const payload = await api.get("/api/auth/me");
        const nextUser = normalizeUser(payload);
        setUser(nextUser);
        localStorage.setItem("kindred_user", JSON.stringify(nextUser));
      } catch {
        localStorage.removeItem("kindred_token");
        localStorage.removeItem("kindred_user");
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  const login = async (email, password) => {
    const response = await api.post("/api/auth/login", { email, password });
    const nextUser = normalizeUser(response.user ?? response);
    localStorage.setItem(
      "kindred_token",
      response.access_token || response.token,
    );
    localStorage.setItem("kindred_user", JSON.stringify(nextUser));
    setUser(nextUser);
    return nextUser;
  };

  const register = async (form) => {
    const response = await api.post("/api/auth/register", form);
    return response;
  };

  const logout = () => {
    localStorage.removeItem("kindred_token");
    localStorage.removeItem("kindred_user");
    setUser(null);
  };

  const value = useMemo(
    () => ({ user, loading, login, register, logout, setUser }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
