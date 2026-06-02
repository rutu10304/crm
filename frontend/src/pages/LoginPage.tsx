import { type FormEvent, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { getDefaultRouteForRole } from "../routing/defaultRoute";
import { ALL_ROLES, ROLE_LABELS, type Role } from "../types/auth";
import { useToast } from "../layout/ToastProvider";
import { SoftoneLogo } from "../components/brand/SoftoneLogo";

interface LocationState {
  from?: {
    pathname?: string;
  };
}

export function LoginPage() {
  const { session, signIn } = useAuth();
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("super_admin");
  const [error, setError] = useState<string | null>(null);

  const redirectPath = useMemo(() => {
    const state = location.state as LocationState | null;
    return state?.from?.pathname ?? getDefaultRouteForRole(role);
  }, [location.state, role]);

  if (session) {
    return <Navigate to={getDefaultRouteForRole(session.role)} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!username.trim() || !password.trim()) {
      setError("Username and password are required.");
      return;
    }

    setError(null);
    const result = await signIn({ username, password, role });

    if (result.ok) {
      if (result.isFallback) {
        pushToast("Backend offline. Logged in with local mock session.", "info");
      } else {
        pushToast("Logged in successfully via MySQL database!", "success");
      }
      navigate(redirectPath, { replace: true });
    } else {
      setError(result.error || "Login failed.");
    }
  }

  return (
    <div className="center-screen">
      <form className="card auth-card stack" onSubmit={handleSubmit}>
        <header className="stack compact">
          <div className="w-full max-w-[280px] mx-auto mb-2">
            <SoftoneLogo />
          </div>
          <h1>Softone ERP Login</h1>
          <p className="muted">
            Admin-controlled access with role and branch scoping.
          </p>
        </header>

        <label className="stack compact">
          Username
          <input
            className="input"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="e.g. Branch Manager"
          />
        </label>

        <label className="stack compact">
          Password
          <input
            className="input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter password"
          />
        </label>

        <label className="stack compact">
          Role
          <select
            className="input"
            value={role}
            onChange={(event) => setRole(event.target.value as Role)}
          >
            {ALL_ROLES.map((roleOption) => (
              <option key={roleOption} value={roleOption}>
                {ROLE_LABELS[roleOption]}
              </option>
            ))}
          </select>
        </label>

        {error ? <p className="error">{error}</p> : null}

        <button className="button primary" type="submit">
          Sign In
        </button>
      </form>
    </div>
  );
}
