import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { AppShell } from "./layout/AppShell";
import { ToastProvider } from "./layout/ToastProvider";
import { PatientModalProvider } from "./context/PatientModalProvider";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { PatientQrPublicPage } from "./pages/public/PatientQrPublicPage";
import { UnauthorizedPage } from "./pages/UnauthorizedPage";
import { AdminUsersPage } from "./pages/modules/AdminUsersPage";
import { AppointmentsPage } from "./pages/modules/AppointmentsPage";
import { AudiologyAssessmentsPage } from "./pages/modules/AudiologyAssessmentsPage";
import { AudiologyTrialsPage } from "./pages/modules/AudiologyTrialsPage";
import { BillingInvoicesPage } from "./pages/modules/BillingInvoicesPage";
import { CrmLeadsPage } from "./pages/modules/CrmLeadsPage";
import { FollowUpCalendarPage } from "./pages/modules/FollowUpCalendarPage";
import { HrOperationsPage } from "./pages/modules/HrOperationsPage";
import { InventoryStockPage } from "./pages/modules/InventoryStockPage";
import { PatientsPage } from "./pages/modules/PatientsPage";
import { QueueBoardPage } from "./pages/modules/QueueBoardPage";
import { ReceptionCheckInPage } from "./pages/modules/ReceptionCheckInPage";
import { RepairTicketsPage } from "./pages/modules/RepairTicketsPage";
import { ReportsPage } from "./pages/modules/ReportsPage";
import { BranchesPage } from "./pages/modules/BranchesPage";
import { SpeechTherapyPage } from "./pages/modules/SpeechTherapyPage";
import { ProtectedRoute } from "./routing/ProtectedRoute";
import { RequireRole } from "./routing/RequireRole";
import { APP_ROUTES } from "./routing/routeConfig";
import type { ReactElement } from "react";

const MODULE_COMPONENTS: Record<string, ReactElement> = {
  "/admin/users": <AdminUsersPage />,
  "/crm/leads": <CrmLeadsPage />,
  "/crm/follow-ups": <FollowUpCalendarPage />,
  "/crm/appointments": <AppointmentsPage />,
  "/reception/check-in": <ReceptionCheckInPage />,
  "/reception/queue": <QueueBoardPage />,
  "/audiology/assessments": <AudiologyAssessmentsPage />,
  "/audiology/trials": <AudiologyTrialsPage />,
  "/billing/invoices": <BillingInvoicesPage />,
  "/repair/tickets": <RepairTicketsPage />,
  "/inventory/stock": <InventoryStockPage />,
  "/patients": <PatientsPage />,
  "/therapy/cases": <SpeechTherapyPage />,
  "/hr/operations": <HrOperationsPage />,
  "/analytics": <ReportsPage />,
  "/reports/branch": <ReportsPage />,
  "/settings": <BranchesPage />,
};
const moduleRoutes = APP_ROUTES.filter((route) => route.path !== "/");
const dashboardRoute = APP_ROUTES.find((route) => route.path === "/");

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <PatientModalProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/p/:token" element={<PatientQrPublicPage />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<AppShell />}>
                <Route
                  index
                  element={
                    <RequireRole allowedRoles={dashboardRoute?.roles ?? []}>
                      <DashboardPage />
                    </RequireRole>
                  }
                />

                {moduleRoutes.map((route) => {
                  const module = MODULE_COMPONENTS[route.path];
                  return (
                    <Route
                      key={route.path}
                      path={route.path.slice(1)}
                      element={
                        <RequireRole allowedRoles={route.roles}>
                          {module ?? <div className="card">Module not configured: {route.label}</div>}
                        </RequireRole>
                      }
                    />
                  );
                })}
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        </PatientModalProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
