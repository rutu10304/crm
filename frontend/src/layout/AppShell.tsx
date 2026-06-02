import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  LayoutDashboard,
  Users,
  PhoneCall,
  CalendarClock,
  Calendar,
  LogIn,
  ListOrdered,
  Volume2,
  Ear,
  CreditCard,
  Wrench,
  Package,
  Briefcase,
  TrendingUp,
  Settings,
  Activity,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { APP_ROUTES } from "../routing/routeConfig";
import { SoftoneLogo } from "../components/brand/SoftoneLogo";

const ROUTE_ICONS: Record<string, any> = {
  "/": LayoutDashboard,
  "/patients": Users,
  "/crm/leads": PhoneCall,
  "/crm/follow-ups": CalendarClock,
  "/crm/appointments": Calendar,
  "/reception/check-in": LogIn,
  "/reception/queue": ListOrdered,
  "/audiology/assessments": Volume2,
  "/audiology/trials": Ear,
  "/billing/invoices": CreditCard,
  "/repair/tickets": Wrench,
  "/inventory/stock": Package,
  "/hr/operations": Briefcase,
  "/analytics": TrendingUp,
  "/settings": Settings,
};

export function AppShell() {
  const { session, signOut } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  if (!session) {
    return null;
  }

  // Filter menu items by the current user's role
  const navigationItems = APP_ROUTES.filter(
    (route) => route.showInNav && route.roles.includes(session.role)
  );

  const menuOrder = [
    "/",
    "/crm/leads",
    "/patients",
    "/crm/appointments",
    "/reception/check-in",
    "/reception/queue",
    "/audiology/assessments",
    "/audiology/trials",
    "/repair/tickets",
    "/inventory/stock",
    "/billing/invoices",
    "/analytics",
    "/hr/operations",
    "/settings",
  ];

  const orderedMenu = menuOrder
    .map((path) => navigationItems.find((item) => item.path === path))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <div className="app-shell min-h-screen bg-[#F8FAFC] text-slate-900">
      <motion.aside
        className="sidebar workspace-sidebar text-slate-800"
        animate={{ width: sidebarCollapsed ? 80 : 310 }}
        transition={{ type: "spring", stiffness: 280, damping: 28 }}
      >
        <div className="sidebar-shell">
          <div className="brand sidebar-brand">
            <div className="inline header-row items-center gap-2">
              <Link
                to="/"
                className="flex-1 min-w-0 decoration-none"
                title="Softone Hearing"
              >
                <SoftoneLogo collapsed={sidebarCollapsed} />
              </Link>
              <button
                className="sidebar-toggle icon-button shrink-0"
                onClick={() => setSidebarCollapsed((prev) => !prev)}
                type="button"
                aria-label="Toggle sidebar"
              >
                {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              </button>
            </div>
          </div>

          <nav className="nav sidebar-nav stack compact">
            {orderedMenu.map((item) => {
              const IconComponent = ROUTE_ICONS[item.path] || Activity;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === "/"}
                  className={({ isActive }) =>
                    `nav-item ${isActive ? "active" : ""} ${sidebarCollapsed ? "nav-item-collapsed" : ""}`
                  }
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <IconComponent size={20} className="nav-icon shrink-0" />
                  {!sidebarCollapsed && (
                    <div className="nav-item-content">
                      <span className="nav-label">{item.label}</span>
                      <small className="nav-description">{item.description}</small>
                    </div>
                  )}
                </NavLink>
              );
            })}
          </nav>

          <div className="sidebar-footer border-t border-slate-200 pt-4 mt-auto">
            <button
              onClick={signOut}
              className={`nav-item signout-btn w-full ${sidebarCollapsed ? "nav-item-collapsed" : ""}`}
              type="button"
              title="Sign Out"
            >
              <LogOut size={20} className="text-red-500 shrink-0" />
              {!sidebarCollapsed && (
                <div className="nav-item-content">
                  <span className="nav-label text-red-600 font-bold">Sign Out</span>
                  <small className="nav-description text-slate-400">Exit your session</small>
                </div>
              )}
            </button>
          </div>
        </div>
      </motion.aside>

      {/* Sidebar spacer to prevent layout overlap */}
      <div 
        className="app-shell-sidebar-spacer" 
        style={{ width: sidebarCollapsed ? 80 : 310 }}
      />

      <main className="content p-5">
        <header className="topbar rounded-2xl border border-[#E2E8F0] bg-white/80 shadow-sm backdrop-blur-md justify-between">
          <div className="flex flex-col gap-0.5 md:flex-row md:items-center md:gap-4 w-full justify-between">
            <strong className="text-base text-blue-900 font-black">{session.fullName}</strong>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 font-semibold">
              <span>Work Number: +91 98101 23456</span>
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
              <span>Personal Number: +91 98765 43210</span>
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
              <span className="text-blue-600 font-bold">Date: {new Date().toLocaleDateString("en-US", { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</span>
            </div>
          </div>
        </header>
        <div className="workspace-layout-full">
          <section className="workspace-main-full">
            <Outlet />
          </section>
        </div>
      </main>
    </div>
  );
}
