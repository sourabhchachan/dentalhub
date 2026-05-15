"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { RECEPTION_PHONE } from "@/lib/clinic";
import { useAuthStore } from "@/store/auth";
import type { Role } from "@/types";

function staffPathForRole(role: Role): string | null {
  switch (role) {
    case "receptionist":
      return "/receptionist/schedule";
    case "doctor":
      return "/doctor/schedule";
    case "admin":
      return "/admin/billing";
    default:
      return null;
  }
}

function isRole(value: string): value is Role {
  return (
    value === "receptionist" ||
    value === "doctor" ||
    value === "admin"
  );
}

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();

    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    const user = authData.user;
    if (!user) {
      setError("Sign-in failed. Please try again.");
      setLoading(false);
      return;
    }

    const { data: staffRow, error: staffError } = await supabase
      .from("staff")
      .select("id, staff_id, name, role")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (staffError) {
      setError(staffError.message);
      setLoading(false);
      return;
    }

    if (!staffRow) {
      setError("Access denied. Contact admin.");
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    if (!isRole(staffRow.role)) {
      setError("Your staff role is not supported for portal login.");
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    const path = staffPathForRole(staffRow.role);
    if (!path) {
      setError("Your staff role is not supported for portal login.");
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    setAuth(
      staffRow.role,
      user.id,
      staffRow.staff_id,
      staffRow.name ?? ""
    );
    router.push(path);
    router.refresh();
    setLoading(false);
  }

  return (
    <div className="min-h-full flex flex-1 flex-col items-center justify-center bg-bg px-4 py-12">
      <div className="dh-login-card w-full max-w-[min(100%,26rem)] overflow-hidden">
        <div className="border-b border-border bg-bg px-6 pb-8 pt-10 text-center sm:px-10 sm:pt-12">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-border-light bg-surface-2 text-4xl shadow-inner"
            aria-hidden
          >
            🦷
          </div>
          <h1 className="font-display text-lg font-bold tracking-tight text-text sm:text-xl">
            Dental Hub
          </h1>
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
            Dr. Surbhi&apos;s Clinic
          </p>
          <p className="mt-4 text-sm font-medium text-text-muted">
            Sign in to your workspace
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-5 bg-surface px-6 py-8 sm:px-10"
        >
          {error ? (
            <div
              role="alert"
              className="rounded-xl border border-danger/35 bg-[color-mix(in_srgb,var(--danger)_14%,var(--surface))] px-4 py-3 text-sm font-semibold text-[#ffb4b4]"
            >
              {error}
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <label
              htmlFor="login-email"
              className="text-xs font-bold uppercase tracking-wider text-text-muted"
            >
              Email
            </label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="dh-input w-full px-4 py-3 text-base"
              placeholder="you@example.com"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="login-password"
              className="text-xs font-bold uppercase tracking-wider text-text-muted"
            >
              Password
            </label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="dh-input w-full px-4 py-3 text-base"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="dh-btn-primary mt-1 flex w-full items-center justify-center px-4 py-3.5 text-base shadow-dh-card"
          >
            {loading ? "Signing in…" : "Log in"}
          </button>
        </form>

        <div className="border-t border-border bg-surface px-6 py-5 text-center sm:px-10">
          <p className="text-sm font-semibold text-primary">
            📞 Reception: {RECEPTION_PHONE}
          </p>
        </div>
      </div>
    </div>
  );
}
