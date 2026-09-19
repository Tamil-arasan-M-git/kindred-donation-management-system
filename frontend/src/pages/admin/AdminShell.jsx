import { DashboardLayout } from "../../components/layout/DashboardLayout";

export default function AdminShell({ children }) {
  return <DashboardLayout role="admin">{children}</DashboardLayout>;
}
