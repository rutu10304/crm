import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import {
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
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { APP_ROUTES, type AppRouteDefinition } from "../routing/routeConfig";
import { SoftoneLogo } from "../components/brand/SoftoneLogo";

const ROUTE_ICONS: Record<string, LucideIcon> = {
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

const GROUP_LABELS: Record<NonNullable<AppRouteDefinition["group"]>, string> = {
  core: "OPERATIONS",
  clinical: "CLINICAL",
  finance: "FINANCE",
  admin: "ADMIN",
};

function routeSortKey(path: string, navPriority?: number): number {
  if (navPriority != null) return navPriority;
  const index = APP_ROUTES.findIndex((r) => r.path === path);
  return index >= 0 ? index : 999;
}

export function AppSidebar() {
  const { session } = useAuth();
  const location = useLocation();

  const groupedNav = useMemo(() => {
    if (!session) return [];

    const routes = APP_ROUTES.filter(
      (r) => r.showInNav && r.roles.includes(session.role)
    ).sort((a, b) => routeSortKey(a.path, a.navPriority) - routeSortKey(b.path, b.navPriority));

    const overview = routes.filter((r) => r.path === "/");
    const byGroup = new Map<string, AppRouteDefinition[]>();

    for (const route of routes) {
      if (route.path === "/") continue;
      const key = route.group ?? "core";
      const list = byGroup.get(key) ?? [];
      list.push(route);
      byGroup.set(key, list);
    }

    const sections: { label: string; routes: AppRouteDefinition[] }[] = [];
    if (overview.length > 0) {
      sections.push({ label: "OVERVIEW", routes: overview });
    }

    const order: NonNullable<AppRouteDefinition["group"]>[] = [
      "core",
      "clinical",
      "finance",
      "admin",
    ];
    for (const group of order) {
      const groupRoutes = byGroup.get(group);
      if (groupRoutes?.length) {
        sections.push({ label: GROUP_LABELS[group], routes: groupRoutes });
      }
    }

    return sections;
  }, [session]);

  if (!session) return null;

  return (
    <aside className="workspace-sidebar w-[240px] shrink-0 flex flex-col">
      <div className="sidebar-shell">
        <Link to="/" className="sidebar-brand decoration-none block w-full">
          <SoftoneLogo />
        </Link>

        <nav className="sidebar-nav mt-2" aria-label="Main navigation">
          {groupedNav.map((section) => (
            <div key={section.label} className="mb-5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-2">
                {section.label}
              </p>
              <ul className="list-none m-0 p-0 flex flex-col gap-0.5">
                {section.routes.map((route) => {
                  const Icon = ROUTE_ICONS[route.path] ?? Activity;
                  const active =
                    route.path === "/"
                      ? location.pathname === "/"
                      : location.pathname === route.path ||
                        location.pathname.startsWith(`${route.path}/`);

                  return (
                    <li key={route.path}>
                      <Link
                        to={route.path}
                        className={`nav-item decoration-none ${active ? "active" : ""}`}
                      >
                        <Icon size={18} className="nav-icon shrink-0" />
                        <span className="nav-label">{route.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}
