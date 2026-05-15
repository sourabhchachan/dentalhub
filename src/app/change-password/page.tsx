"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/auth";
import type { Role } from "@/types";

function dashboardPathForRole(role: Role | null): string {
  switch (role) {
    case "receptionist":
      return "/receptionist/schedule";
    case "doctor":
      return "/doctor/schedule";
    case "admin":
      return "/admin/billing";
    default:
      return "/login";
  }
}

export default function ChangePasswordPage() {
  const role = useAuthStore((s) => s.role);
  const backHref = dashboardPathForRole(role);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setSuccess("Password updated successfully");
    setNewPassword("");
    setConfirmPassword("");
    setLoading(false);
  }

  return (
    <div className="min-h-full flex flex-1 flex-col items-center justify-center bg-bg px-4 py-12">
      <div className="dh-login-card w-full max-w-[min(100%,26rem)] overflow-hidden">
        <div className="border-b border-border bg-bg px-6 pb-6 pt-8 text-center sm:px-10 sm:pt-10">
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border-light bg-surface-2 text-3xl shadow-inner"
            aria-hidden
          >
            🔒
          </div>
          <h1 className="font-display text-lg font-bold tracking-tight text-text sm:text-xl">
            Change Password
          </h1>
          <p className="mt-2 text-sm font-medium text-text-muted">
            Set a new password for your account
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

          {success ? (
            <div
              role="status"
              className="rounded-xl border border-primary/35 bg-[color-mix(in_srgb,var(--primary)_14%,var(--surface))] px-4 py-3 text-sm font-semibold text-primary"
            >
              {success}
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <label
              htmlFor="new-password"
              className="text-xs font-bold uppercase tracking-wider text-text-muted"
            >
              New Password
            </label>
            <input
              id="new-password"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="dh-input w-full px-4 py-3 text-base"
              placeholder="••••••••"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="confirm-password"
              className="text-xs font-bold uppercase tracking-wider text-text-muted"
            >
              Confirm Password
            </label>
            <input
              id="confirm-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="dh-input w-full px-4 py-3 text-base"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="dh-btn-primary mt-1 flex w-full items-center justify-center px-4 py-3.5 text-base shadow-dh-card"
          >
            {loading ? "Updating…" : "Update Password"}
          </button>

          <Link
            href={backHref}
            className="dh-btn-ghost flex w-full items-center justify-center px-4 py-3 text-sm"
          >
            ← Back to dashboard
          </Link>
        </form>
      </div>
    </div>
  );
}
