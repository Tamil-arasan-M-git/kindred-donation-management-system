import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ProtectedRoute from "./ProtectedRoute";
import LoginPage from "../pages/auth/LoginPage";
import RegisterPage from "../pages/auth/RegisterPage";
import DonorDashboard from "../pages/donor/DonorDashboard";
import DonorScanPage from "../pages/donor/DonorScanPage";
import DonorReviewPage from "../pages/donor/DonorReviewPage";
import DonorDonationsPage from "../pages/donor/DonorDonationsPage";
import DonorDonationDetailPage from "../pages/donor/DonorDonationDetailPage";
import DonorMatchesPage from "../pages/donor/DonorMatchesPage";
import DonorPickupPage from "../pages/donor/DonorPickupPage";
import DonorProfilePage from "../pages/donor/DonorProfilePage";
import NGODashboard from "../pages/ngo/NGODashboard";
import NGODemandsPage from "../pages/ngo/NGODemandsPage";
import NGOMatchesPage from "../pages/ngo/NGOMatchesPage";
import NGODonationsPage from "../pages/ngo/NGODonationsPage";
import NGOProfilePage from "../pages/ngo/NGOProfilePage";
import NGODonationDetailPage from "../pages/ngo/NGODonationDetailPage";
import NGOStaffPage from "../pages/ngo/NGOStaffPage";
import NGOOperationsPage from "../pages/ngo/NGOOperationsPage";
import AdminDashboard from "../pages/admin/AdminDashboard";
import AdminNGOsPage from "../pages/admin/AdminNGOsPage";
import AdminDonorsPage from "../pages/admin/AdminDonorsPage";
import AdminDonationsPage from "../pages/admin/AdminDonationsPage";
import AdminDemandsPage from "../pages/admin/AdminDemandsPage";
import AdminMatchesPage from "../pages/admin/AdminMatchesPage";

const roleHome = { donor: "/donor", ngo: "/ngo", admin: "/admin" };
const getDestination = (user) =>
  user ? roleHome[user.role] || "/login" : "/login";

export default function AppRoutes() {
  const { user } = useAuth();
  const destination = user ? getDestination(user) : "/login";

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<ProtectedRoute allowedRoles={["donor"]} />}>
        <Route path="/donor" element={<DonorDashboard />} />
        <Route path="/donor/scan" element={<DonorScanPage />} />
        <Route path="/donor/review" element={<DonorReviewPage />} />
        <Route path="/donor/donations" element={<DonorDonationsPage />} />
        <Route
          path="/donor/donations/:id"
          element={<DonorDonationDetailPage />}
        />
        <Route
          path="/donor/donations/:id/matches"
          element={<DonorDonationDetailPage />}
        />
        <Route path="/donor/matches" element={<DonorMatchesPage />} />
        <Route path="/donor/pickup" element={<DonorPickupPage />} />
        <Route path="/donor/profile" element={<DonorProfilePage />} />
      </Route>
      <Route element={<ProtectedRoute allowedRoles={["ngo"]} />}>
        <Route path="/ngo" element={<NGODashboard />} />
        <Route path="/ngo/demands" element={<NGODemandsPage />} />
        <Route path="/ngo/matches" element={<NGOMatchesPage />} />
        <Route path="/ngo/matches/:id" element={<NGOMatchesPage />} />
        <Route path="/ngo/donations" element={<NGODonationsPage />} />
        <Route path="/ngo/donations/:id" element={<NGODonationDetailPage />} />
        <Route path="/ngo/operations" element={<NGOOperationsPage />} />
        <Route path="/ngo/staff" element={<NGOStaffPage />} />
        <Route path="/ngo/profile" element={<NGOProfilePage />} />
      </Route>
      <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/ngos" element={<AdminNGOsPage />} />
        <Route path="/admin/donors" element={<AdminDonorsPage />} />
        <Route path="/admin/donations" element={<AdminDonationsPage />} />
        <Route path="/admin/demands" element={<AdminDemandsPage />} />
        <Route path="/admin/matches" element={<AdminMatchesPage />} />
      </Route>
      <Route path="/" element={<Navigate to={destination} replace />} />
      <Route path="*" element={<Navigate to={destination} replace />} />
    </Routes>
  );
}
