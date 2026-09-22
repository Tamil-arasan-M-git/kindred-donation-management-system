import { DashboardLayout } from "../../components/layout/DashboardLayout";

export default function NGOShell({ children }) {
  return <DashboardLayout role="ngo">{children}</DashboardLayout>;
}
