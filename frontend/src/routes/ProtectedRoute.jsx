import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({
  allowedRoles = [],
  redirectTo = "/login",
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="page-loading">Loading account…</div>;
  }

  if (!user) {
    return <Navigate to={redirectTo} replace />;
  }

  if (allowedRoles.length && !allowedRoles.includes(user.role)) {
    const homeMap = {
      donor: "/donor",
      ngo: "/ngo",
      admin: "/admin",
    };
    return <Navigate to={homeMap[user.role] || "/login"} replace />;
  }

  return <Outlet />;
}
