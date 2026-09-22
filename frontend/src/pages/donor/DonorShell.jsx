import { DashboardLayout } from "../../components/layout/DashboardLayout";

export default function DonorShell({ children }) {
  return <DashboardLayout role="donor">{children}</DashboardLayout>;
}
