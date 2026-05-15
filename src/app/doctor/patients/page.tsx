"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AppointmentStatus, Patient } from "@/types";

type PatientRow = Patient & { medical_notes?: string | null };

type HistoryRow = {
  id: string;
  date: string;
  time: string;
  reason: string;
  status: AppointmentStatus;
};

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

export default function DoctorPatientsPage() {
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalPatientId, setModalPatientId] = useState<string | null>(null);
  const [modalPatient, setModalPatient] = useState<Patient | null>(null);
  const [modalHistory, setModalHistory] = useState<HistoryRow[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  const loadPatients = useCallback(async () => {
    const supabase = createClient();
    const { data, error: qErr } = await supabase
      .from("patients")
      .select("*")
      .order("name", { ascending: true });
    if (qErr) {
      setError(qErr.message);
      setPatients([]);
      return;
    }
    setPatients((data ?? []) as PatientRow[]);
    setError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await loadPatients();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPatients]);

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter((p) => {
      const name = (p.name ?? "").toLowerCase();
      const phone = (p.phone ?? "").toLowerCase().replace(/\s/g, "");
      const qPhone = q.replace(/\s/g, "");
      return name.includes(q) || phone.includes(qPhone);
    });
  }, [patients, search]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-bold tracking-tight text-text">
          Patients
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Full roster · {patients.length} patients
        </p>
      </div>

      <div className="relative">
        <label htmlFor="doc-patient-search" className="sr-only">
          Search patients
        </label>
        <input
          id="doc-patient-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or phone…"
          className="dh-input w-full px-4 py-3 pl-11 text-sm"
        />
        <span
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted"
          aria-hidden
        >
          ⌕
        </span>
      </div>

      {error ? (
        <div
          role="alert"
          className="dh-card border-danger/35 bg-[color-mix(in_srgb,var(--danger)_12%,var(--surface))] px-4 py-3 text-sm font-semibold text-[#ffb4b4]"
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-[16px] border border-border bg-surface"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="dh-card flex flex-col items-center justify-center px-6 py-16 text-center">
          <span className="text-[48px] leading-none" aria-hidden>
            🦷
          </span>
          <p className="font-display mt-5 text-lg font-bold text-text">
            {patients.length === 0 ? "No patients" : "No matches"}
          </p>
          <p className="mt-2 max-w-sm text-sm text-text-muted">
            {patients.length === 0
              ? "Patients will appear here once registered."
              : "Try another search."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setModalPatientId(p.id)}
                className="dh-card w-full border-l-4 border-l-primary p-4 text-left transition hover:border-border-light sm:p-5"
              >
                <p className="font-display text-lg font-bold text-text">
                  {p.name}
                </p>
                <p className="mt-1 text-sm text-text-muted">{p.phone}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-text-muted">
                  {p.age != null && !Number.isNaN(Number(p.age)) ? (
                    <span className="rounded-full border border-border bg-surface-2 px-2.5 py-1">
                      Age {p.age}
                    </span>
                  ) : (
                    <span className="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-text-subtle">
                      Age —
                    </span>
                  )}
                  {p.blood_group ? (
                    <span className="rounded-full border border-border bg-surface-2 px-2.5 py-1">
                      {p.blood_group}
                    </span>
                  ) : (
                    <span className="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-text-subtle">
                      Blood —
                    </span>
                  )}
                </div>
                <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-primary">
                  View chart
                </p>
              </button>
            </li>
          ))}
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
                        No visits on record.
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
