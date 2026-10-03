import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import AppRoutes from "./routes/AppRoutes";
import PWAStatus from "./components/common/PWAStatus";
import "./App.css";

export default function App() {
  return (
    <AuthProvider>
      <PWAStatus />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
