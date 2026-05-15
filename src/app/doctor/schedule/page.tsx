"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AppointmentStatus, Patient } from "@/types";

type ApptRow = {
  id: string;
  patient_id: string;
  date: string;
  time: string;
  status: AppointmentStatus;
  reason: string;
  patients: { name: string } | null;
};

type HistoryRow = {
  id: string;
  date: string;
  time: string;
  reason: string;
  status: AppointmentStatus;
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

function normalizeAppt(raw: Record<string, unknown>): ApptRow {
  return {
    id: String(raw.id),
    patient_id: String(raw.patient_id),
    date: String(raw.date),
    time: String(raw.time),
    status: raw.status as AppointmentStatus,
    reason: String(raw.reason ?? ""),
    patients: pickJoinedName(raw.patients),
  };
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0]!;
}

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
          className="h-32 animate-pulse rounded-[16px] border border-border bg-surface shadow-dh-card"
        />
      ))}
    </div>
  );
}

export default function DoctorSchedulePage() {
  const [doctorStaffId, setDoctorStaffId] = useState<string | null>(null);
  const [rows, setRows] = useState<ApptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const date = useMemo(() => todayISO(), []);

  const [modalPatientId, setModalPatientId] = useState<string | null>(null);
  const [modalPatient, setModalPatient] = useState<Patient | null>(null);
  const [modalHistory, setModalHistory] = useState<HistoryRow[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  const loadDay = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    const uid = authData.user?.id;
    if (authErr || !uid) {
      setError(authErr?.message ?? "Not signed in.");
      setDoctorStaffId(null);
      setRows([]);
      setLoading(false);
      return;
    }

    const { data: staff, error: sErr } = await supabase
      .from("staff")
      .select("id")
      .eq("auth_user_id", uid)
      .maybeSingle();

    if (sErr || !staff) {
      setError(sErr?.message ?? "No staff profile linked to this account.");
      setDoctorStaffId(null);
      setRows([]);
      setLoading(false);
      return;
    }

    const sid = String(staff.id);
    setDoctorStaffId(sid);

    const { data, error: qErr } = await supabase
      .from("appointments")
      .select(
        `
        id,
        patient_id,
        date,
        time,
        status,
        reason,
        patients ( name )
      `
      )
      .eq("doctor_id", sid)
      .eq("date", date)
      .order("time", { ascending: true });

    if (qErr) {
      setError(qErr.message);
      setRows([]);
    } else {
      setRows((data ?? []).map((r) => normalizeAppt(r as Record<string, unknown>)));
      setError(null);
    }
    setLoading(false);
  }, [date]);

  const refreshRows = useCallback(async () => {
    if (!doctorStaffId) return;
    const supabase = createClient();
    const { data, error: qErr } = await supabase
      .from("appointments")
      .select(
        `
        id,
        patient_id,
        date,
        time,
        status,
        reason,
        patients ( name )
      `
      )
      .eq("doctor_id", doctorStaffId)
      .eq("date", date)
      .order("time", { ascending: true });

    if (qErr) {
      setError(qErr.message);
      setRows([]);
      return;
    }
    setRows((data ?? []).map((r) => normalizeAppt(r as Record<string, unknown>)));
    setError(null);
  }, [doctorStaffId, date]);

  useEffect(() => {
    void loadDay();
  }, [loadDay]);

  useEffect(() => {
    if (!doctorStaffId) return;
    const supabase = createClient();
    const channel = supabase
      .channel("doctor-appointments")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        () => {
          void refreshRows();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [doctorStaffId, refreshRows]);

  useEffect(() => {
    if (!modalPatientId) {
      setModalPatient(null);
      setModalHistory([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setModalLoading(true);
      const supabase = createClient();
      const [{ data: p, error: pErr }, { data: hist, error: hErr }] =
        await Promise.all([
          supabase.from("patients").select("*").eq("id", modalPatientId).maybeSingle(),
          supabase
            .from("appointments")
            .select("id, date, time, reason, status")
            .eq("patient_id", modalPatientId)
            .order("date", { ascending: false })
            .order("time", { ascending: false }),
        ]);
      if (!cancelled) {
        if (pErr) setModalPatient(null);
        else setModalPatient((p ?? null) as Patient | null);
        if (hErr) setModalHistory([]);
        else
          setModalHistory(
            (hist ?? []) as {
              id: string;
              date: string;
              time: string;
              reason: string;
              status: AppointmentStatus;
            }[]
          );
        setModalLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [modalPatientId]);

  useEffect(() => {
    if (!modalPatientId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModalPatientId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalPatientId]);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold tracking-tight text-text">
          My day
        </h1>
        <p className="mt-1 text-sm font-medium text-text-muted">{date}</p>
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
      ) : !doctorStaffId ? null : rows.length === 0 ? (
        <div className="dh-card flex flex-col items-center justify-center px-6 py-16 text-center">
          <span className="text-[48px] leading-none" aria-hidden>
            🦷
          </span>
          <p className="font-display mt-5 text-lg font-bold text-text">
            No appointments today
          </p>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-text-muted">
            Your schedule for this date is clear. New bookings will appear here
            in real time.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {rows.map((appt) => {
            const patientName = appt.patients?.name ?? "Patient";
            return (
              <li key={appt.id}>
                <button
                  type="button"
                  onClick={() => setModalPatientId(appt.patient_id)}
                  className={`dh-card w-full border-l-4 p-4 text-left transition hover:border-border-light sm:p-5 ${statusLeftBorderClass(appt.status)}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display text-[15px] font-bold text-text">
                        {patientName}
                      </p>
                      <p className="mt-2 inline-flex rounded-full bg-primary px-3 py-1 text-xs font-bold text-black">
                        {appt.time}
                      </p>
                    </div>
                    <span
                      className={`inline-flex shrink-0 rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${statusBadgeClass(appt.status)}`}
                    >
                      {appt.status}
                    </span>
                  </div>
                  {appt.reason ? (
                    <p className="mt-3 text-sm text-text-muted">{appt.reason}</p>
                  ) : null}
                  <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-primary">
                    Tap for patient chart
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {modalPatientId ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
            aria-label="Close"
            onClick={() => setModalPatientId(null)}
          />
          <div className="relative z-10 max-h-[min(92vh,720px)] w-full max-w-lg sm:rounded-[16px]">
            <div className="dh-card flex max-h-[min(92vh,720px)] flex-col overflow-hidden rounded-b-none sm:rounded-b-[16px]">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <h2 className="font-display text-lg font-bold text-text">
                  Patient details
                </h2>
                <button
                  type="button"
                  onClick={() => setModalPatientId(null)}
                  className="dh-btn-ghost rounded-lg px-3 py-1.5 text-xs"
                >
                  Close
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-5">
                {modalLoading ? (
                  <div className="h-40 animate-pulse rounded-xl bg-surface-2" />
                ) : modalPatient ? (
                  <>
                    <p className="font-display text-xl font-bold text-text">
                      {modalPatient.name}
                    </p>
                    <dl className="mt-4 space-y-2 text-sm text-text-muted">
                      <div className="flex justify-between gap-4 border-b border-border pb-2">
                        <dt className="text-text-subtle">Phone</dt>
                        <dd className="font-medium text-text">{modalPatient.phone}</dd>
                      </div>
                      <div className="flex justify-between gap-4 border-b border-border pb-2">
                        <dt className="text-text-subtle">Age</dt>
                        <dd className="font-medium text-text">
                          {modalPatient.age ?? "—"}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4 border-b border-border pb-2">
                        <dt className="text-text-subtle">Blood group</dt>
                        <dd className="font-medium text-text">
                          {modalPatient.blood_group ?? "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-text-subtle">Medical notes</dt>
                        <dd className="mt-1 leading-relaxed text-text">
                          {modalPatient.medical_notes?.trim()
                            ? modalPatient.medical_notes
                            : "—"}
                        </dd>
                      </div>
                    </dl>
                    <h3 className="mt-8 font-display text-base font-bold text-text">
                      Appointment history
                    </h3>
                    {modalHistory.length === 0 ? (
                      <p className="mt-2 text-sm text-text-muted">
                        No prior visits on record.
                      </p>
                    ) : (
                      <ul className="mt-3 space-y-2">
                        {modalHistory.map((h) => (
                          <li
                            key={h.id}
                            className="rounded-xl border border-border bg-surface-2 px-3 py-2.5"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-xs font-bold text-primary">
                                {h.date} · {h.time}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${statusBadgeClass(h.status)}`}
                              >
                                {h.status}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-text-muted">
                              {h.reason || "—"}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-text-muted">Patient not found.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
