"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AppointmentStatus } from "@/types";

const STATUSES: AppointmentStatus[] = [
  "Scheduled",
  "Arrived",
  "In-chair",
  "Done",
  "No-show",
];

function todayISO(): string {
  return new Date().toISOString().split("T")[0]!;
}

function StatCard({
  label,
  value,
  sub,
  loading,
}: {
  label: string;
  value: string | number;
  sub?: string;
  loading: boolean;
}) {
  return (
    <div className="dh-stat-card flex flex-1 flex-col p-3.5">
      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
        {label}
      </span>
      {loading ? (
        <div className="mt-2 h-9 w-16 animate-pulse rounded-lg bg-border" />
      ) : (
        <span className="font-display mt-1 text-2xl font-bold tabular-nums tracking-tight text-primary">
          {value}
        </span>
      )}
      {sub ? (
        <span className="mt-1 text-[10px] font-medium text-text-subtle">{sub}</span>
      ) : null}
    </div>
  );
}

export default function AdminReportsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [todayAppts, setTodayAppts] = useState(0);
  const [totalAppts, setTotalAppts] = useState(0);
  const [totalPatients, setTotalPatients] = useState(0);
  const [revenueCollected, setRevenueCollected] = useState(0);
  const [revenuePending, setRevenuePending] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [topDoctors, setTopDoctors] = useState<{ name: string; count: number }[]>(
    []
  );

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const today = todayISO();

    const [apRes, patRes, billRes, staffRes] = await Promise.all([
      supabase.from("appointments").select("id, date, status, doctor_id"),
      supabase.from("patients").select("id", { count: "exact", head: true }),
      supabase.from("bills").select("total, paid"),
      supabase.from("staff").select("id, name, role"),
    ]);

    if (apRes.error) {
      setError(apRes.error.message);
      setLoading(false);
      return;
    }
    if (patRes.error) {
      setError(patRes.error.message);
      setLoading(false);
      return;
    }
    if (billRes.error) {
      setError(billRes.error.message);
      setLoading(false);
      return;
    }

    const appts = apRes.data ?? [];
    setTodayAppts(appts.filter((a) => a.date === today).length);
    setTotalAppts(appts.length);
    setTotalPatients(patRes.count ?? 0);

    const bills = billRes.data ?? [];
    let coll = 0;
    let pend = 0;
    for (const b of bills) {
      const t = Number(b.total) || 0;
      if (b.paid) coll += t;
      else pend += t;
    }
    setRevenueCollected(coll);
    setRevenuePending(pend);

    const sc: Record<string, number> = {};
    for (const s of STATUSES) sc[s] = 0;
    for (const a of appts) {
      const st = String(a.status);
      sc[st] = (sc[st] ?? 0) + 1;
    }
    setStatusCounts(sc);

    const docMap = new Map<string, number>();
    for (const a of appts) {
      const did = String(a.doctor_id);
      docMap.set(did, (docMap.get(did) ?? 0) + 1);
    }
    const staffList = (staffRes.data ?? []) as { id: string; name: string; role: string }[];
    const staffName = new Map(staffList.map((s) => [s.id, s.name]));
    const tops = [...docMap.entries()]
      .map(([id, count]) => ({ name: staffName.get(id) ?? "Unknown", count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    setTopDoctors(tops);
    setError(staffRes.error?.message ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const maxStatus = useMemo(() => {
    return Math.max(1, ...STATUSES.map((s) => statusCounts[s] ?? 0));
  }, [statusCounts]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold tracking-tight text-text">
          Reports
        </h1>
        <p className="mt-1 text-sm text-text-muted">Clinic pulse at a glance</p>
      </div>

      {error ? (
        <div
          role="alert"
          className="dh-card border-danger/35 bg-[color-mix(in_srgb,var(--danger)_12%,var(--surface))] px-4 py-3 text-sm font-semibold text-[#ffb4b4]"
        >
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <StatCard
          label="Today"
          value={todayAppts}
          sub="Appointments"
          loading={loading}
        />
        <StatCard
          label="Total appts"
          value={totalAppts}
          loading={loading}
        />
        <StatCard
          label="Patients"
          value={totalPatients}
          loading={loading}
        />
        <StatCard
          label="Collected"
          value={`₹${revenueCollected.toFixed(0)}`}
          loading={loading}
        />
        <StatCard
          label="Pending"
          value={`₹${revenuePending.toFixed(0)}`}
          sub="Outstanding"
          loading={loading}
        />
      </div>

      <div className="dh-card p-5">
        <h2 className="font-display text-base font-bold text-text">
          Appointment status
        </h2>
        <ul className="mt-4 space-y-3">
          {STATUSES.map((s) => {
            const c = statusCounts[s] ?? 0;
            const pct = Math.round((c / maxStatus) * 100);
            return (
              <li key={s}>
                <div className="flex items-center justify-between text-xs font-semibold text-text-muted">
                  <span>{s}</span>
                  <span className="text-primary">{c}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="dh-card p-5">
        <h2 className="font-display text-base font-bold text-text">
          Top doctors
        </h2>
        {loading ? (
          <div className="mt-4 h-24 animate-pulse rounded-xl bg-surface-2" />
        ) : topDoctors.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">No appointment data yet.</p>
        ) : (
          <ol className="mt-4 space-y-2">
            {topDoctors.map((d, i) => (
              <li
                key={d.name + i}
                className="flex items-center justify-between rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm"
              >
                <span className="font-medium text-text">
                  {i + 1}. {d.name}
                </span>
                <span className="font-display font-bold text-primary">{d.count}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
