"use client";

import { Stethoscope } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { RECEPTION_PHONE_DISPLAY } from "@/lib/clinic";
import type { AppointmentStatus } from "@/types";

const STATUSES: AppointmentStatus[] = [
  "Scheduled",
  "Arrived",
  "In-chair",
  "Done",
  "No-show",
];

type AppointmentRow = {
  id: string;
  patient_id: string;
  doctor_id: string;
  date: string;
  time: string;
  status: AppointmentStatus;
  reason: string;
  created_at: string;
  patients: { name: string } | null;
  staff: { name: string } | null;
};

function pickJoinedName(rel: unknown): { name: string } | null {
  if (rel == null) return null;
  if (Array.isArray(rel)) {
    const first = rel[0] as { name?: string } | undefined;
    if (!first) return null;
    return { name: first.name ?? "" };
  }
  if (typeof rel === "object" && "name" in rel) {
    return { name: String((rel as { name?: string }).name ?? "") };
  }
  return null;
}

function normalizeAppointmentRow(raw: Record<string, unknown>): AppointmentRow {
  return {
    id: String(raw.id),
    patient_id: String(raw.patient_id),
    doctor_id: String(raw.doctor_id),
    date: String(raw.date),
    time: String(raw.time),
    status: raw.status as AppointmentStatus,
    reason: String(raw.reason ?? ""),
    created_at: String(raw.created_at ?? ""),
    patients: pickJoinedName(raw.patients),
    staff: pickJoinedName(raw.staff),
  };
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0]!;
}

/** Active pipeline: gold accent. Terminal / inactive: subtle slate border. */
function statusLeftBorderClass(status: AppointmentStatus): string {
  switch (status) {
    case "Scheduled":
    case "Arrived":
    case "In-chair":
      return "border-l-primary";
    case "Done":
    case "No-show":
      return "border-l-text-subtle";
    default:
      return "border-l-border-light";
  }
}

function statusBadgeClass(status: AppointmentStatus): string {
  switch (status) {
    case "Scheduled":
      return "bg-surface-2 text-sky-300 ring-sky-500/25";
    case "Arrived":
      return "bg-surface-2 text-amber-300 ring-amber-500/25";
    case "In-chair":
      return "bg-surface-2 text-emerald-300 ring-emerald-500/25";
    case "Done":
      return "bg-surface-2 text-text-muted ring-border-light";
    case "No-show":
      return "bg-surface-2 text-rose-300 ring-rose-500/25";
    default:
      return "bg-surface-2 text-text-muted ring-border";
  }
}

function StatCard({
  label,
  value,
  loading,
}: {
  label: string;
  value: number;
  loading: boolean;
}) {
  return (
    <div className="dh-stat-card flex flex-1 flex-col p-3.5">
      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
        {label}
      </span>
      {loading ? (
        <div className="mt-2 h-9 w-14 animate-pulse rounded-lg bg-border" />
      ) : (
        <span className="font-display mt-1 text-3xl font-bold tabular-nums tracking-tight text-primary">
          {value}
        </span>
      )}
    </div>
  );
}

function ScheduleSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2.5">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-[5.25rem] animate-pulse rounded-[16px] border border-border bg-surface"
          />
        ))}
      </div>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-44 animate-pulse rounded-[16px] border border-border bg-surface shadow-dh-card"
        />
      ))}
    </div>
  );
}

export default function ReceptionistSchedulePage() {
  const [rows, setRows] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const date = useMemo(() => todayISO(), []);

  const fetchAppointments = useCallback(async () => {
    const supabase = createClient();
    const { data, error: qError } = await supabase
      .from("appointments")
      .select(
        `
        id,
        patient_id,
        doctor_id,
        date,
        time,
        status,
        reason,
        created_at,
        patients ( name ),
        staff ( name )
      `
      )
      .eq("date", date)
      .order("time", { ascending: true });

    if (qError) {
      setError(qError.message);
      setRows([]);
      return;
    }

    const list = (data ?? []).map((row) =>
      normalizeAppointmentRow(row as Record<string, unknown>)
    );
    setRows(list);
    setError(null);
  }, [date]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await fetchAppointments();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchAppointments]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("appointments-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        () => {
          void fetchAppointments();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchAppointments]);

  const stats = useMemo(() => {
    const total = rows.length;
    const done = rows.filter((r) => r.status === "Done").length;
    const pending = rows.filter(
      (r) =>
        r.status === "Scheduled" ||
        r.status === "Arrived" ||
        r.status === "In-chair"
    ).length;
    return { total, done, pending };
  }, [rows]);

  async function updateStatus(id: string, status: AppointmentStatus) {
    setUpdatingId(id);
    setError(null);
    const supabase = createClient();
    const { error: uError } = await supabase
      .from("appointments")
      .update({ status })
      .eq("id", id);

    if (uError) {
      setError(uError.message);
      setUpdatingId(null);
      return;
    }

    await fetchAppointments();
    setUpdatingId(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold tracking-tight text-text">
          Today&apos;s schedule
        </h1>
        <p className="mt-1 text-sm font-medium text-text-muted">{date}</p>
        <p className="mt-2 text-xs font-semibold text-primary">
          {RECEPTION_PHONE_DISPLAY}
        </p>
      </div>

      {error ? (
        <div
          role="alert"
          className="dh-card border-danger/35 bg-[color-mix(in_srgb,var(--danger)_12%,var(--surface))] px-4 py-3 text-sm font-semibold text-[#ffb4b4]"
        >
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-2.5">
        <StatCard label="Total" value={stats.total} loading={loading} />
        <StatCard label="Done" value={stats.done} loading={loading} />
        <StatCard label="Pending" value={stats.pending} loading={loading} />
      </div>

      {loading ? (
        <ScheduleSkeleton />
      ) : rows.length === 0 ? (
        <div className="dh-card flex flex-col items-center justify-center px-6 py-16 text-center">
          <span className="text-[48px] leading-none" aria-hidden>
            🦷
          </span>
          <p className="font-display mt-5 text-lg font-bold text-text">
            No appointments today
          </p>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-text-muted">
            When bookings are added for this date, they will appear here
            automatically—including live updates from your team.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {rows.map((appt) => {
            const patientName = appt.patients?.name ?? "Unknown patient";
            const doctorName = appt.staff?.name ?? "—";
            const busy = updatingId === appt.id;

            return (
              <li
                key={appt.id}
                className={`dh-card border-l-4 p-4 sm:p-5 ${statusLeftBorderClass(appt.status)}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-[15px] font-bold leading-snug text-text">
                      {patientName}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="inline-flex rounded-full bg-primary px-3 py-1 text-xs font-bold text-black shadow-sm">
                        {appt.time}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-muted">
                        <Stethoscope
                          className="shrink-0 text-primary"
                          size={16}
                          strokeWidth={2.25}
                          aria-hidden
                        />
                        {doctorName}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`inline-flex shrink-0 rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${statusBadgeClass(appt.status)}`}
                  >
                    {appt.status}
                  </span>
                </div>
                {appt.reason ? (
                  <p className="mt-3 text-sm leading-relaxed text-text-muted">
                    {appt.reason}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  {STATUSES.map((s) => {
                    const active = appt.status === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        disabled={busy || active}
                        onClick={() => void updateStatus(appt.id, s)}
                        className={`dh-btn rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide ${
                          active
                            ? "cursor-default border-primary bg-primary/15 text-primary-light"
                            : "border-border bg-surface-2 text-text-muted hover:border-border-light hover:text-text"
                        } disabled:cursor-not-allowed disabled:opacity-45`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
