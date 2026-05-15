"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type DoctorRow = { id: string; name: string; staff_id: string; role: string };
type PatientPick = { id: string; name: string; phone: string };

function timeSlots(): string[] {
  const out: string[] = [];
  for (let t = 9 * 60; t <= 18 * 60; t += 30) {
    const h = Math.floor(t / 60);
    const m = t % 60;
    out.push(
      `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
    );
  }
  return out;
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0]!;
}

function escapeIlike(q: string): string {
  return q.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

const SLOTS = timeSlots();

export default function ReceptionistBookPage() {
  const [doctors, setDoctors] = useState<DoctorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [patientQuery, setPatientQuery] = useState("");
  const [patientOpen, setPatientOpen] = useState(false);
  const [patientResults, setPatientResults] = useState<PatientPick[]>([]);
  const [patientLoading, setPatientLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientPick | null>(
    null
  );

  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState(todayISO);
  const [time, setTime] = useState("09:00");
  const [reason, setReason] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    patientName: string;
    doctorName: string;
    date: string;
    time: string;
  } | null>(null);

  const patientFieldRef = useRef<HTMLDivElement>(null);

  const loadDoctors = useCallback(async () => {
    const supabase = createClient();
    const { data, error: dErr } = await supabase
      .from("staff")
      .select("id, staff_id, name, role")
      .eq("role", "doctor")
      .order("name", { ascending: true });

    if (dErr) {
      setError(dErr.message);
      setDoctors([]);
      return;
    }
    setDoctors((data ?? []) as DoctorRow[]);
    setError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await loadDoctors();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadDoctors]);

  useEffect(() => {
    if (doctors.length > 0 && doctorId === "") {
      setDoctorId(doctors[0]!.id);
    }
  }, [doctors, doctorId]);

  useEffect(() => {
    if (!patientOpen) {
      setPatientLoading(false);
      return;
    }
    const q = patientQuery.trim();
    if (q.length < 1) {
      setPatientResults([]);
      return;
    }
    if (selectedPatient && selectedPatient.name === q) {
      setPatientResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setPatientLoading(true);
      const supabase = createClient();
      const safe = escapeIlike(q);
      const { data, error: pErr } = await supabase
        .from("patients")
        .select("id, name, phone")
        .or(`name.ilike.%${safe}%,phone.ilike.%${safe}%`)
        .limit(25);

      if (!pErr) setPatientResults((data ?? []) as PatientPick[]);
      setPatientLoading(false);
    }, 220);
    return () => clearTimeout(t);
  }, [patientQuery, patientOpen, selectedPatient]);

  useEffect(() => {
    if (!patientOpen) return;
    function handlePointerDown(e: PointerEvent) {
      const el = patientFieldRef.current;
      if (el && !el.contains(e.target as Node)) {
        setPatientOpen(false);
      }
    }
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [patientOpen]);

  const resetForm = useCallback(() => {
    setPatientQuery("");
    setPatientResults([]);
    setSelectedPatient(null);
    setPatientOpen(false);
    setDate(todayISO());
    setTime("09:00");
    setReason("");
    setSubmitError(null);
    setDoctorId((prev) => doctors[0]?.id ?? prev);
  }, [doctors]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!selectedPatient) {
      setSubmitError("Select a patient.");
      return;
    }
    if (!doctorId) {
      setSubmitError("Select a doctor.");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      setSubmitError(userErr?.message ?? "Not signed in.");
      setSubmitting(false);
      return;
    }

    const doctorName =
      doctors.find((d) => d.id === doctorId)?.name ?? "";

    const { error: insErr } = await supabase.from("appointments").insert({
      patient_id: selectedPatient.id,
      doctor_id: doctorId,
      date,
      time,
      reason: reason.trim() || "",
      status: "Scheduled",
      booked_by: userData.user.id,
    });

    if (insErr) {
      setSubmitError(insErr.message);
      setSubmitting(false);
      return;
    }

    setSuccess({
      patientName: selectedPatient.name,
      doctorName,
      date,
      time,
    });
    resetForm();
    setSubmitting(false);
  }

  function handleBookAnother() {
    setSuccess(null);
    resetForm();
  }

  if (success) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-xl font-bold tracking-tight text-text">
          Book appointment
        </h1>
        <div className="dh-card border-l-4 border-l-primary p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">
            Confirmed
          </p>
          <p className="font-display mt-3 text-lg font-bold text-text">
            {success.patientName}
          </p>
          <dl className="mt-4 space-y-2 text-sm text-text-muted">
            <div className="flex justify-between gap-4 border-b border-border pb-2">
              <dt className="font-semibold text-text-subtle">Doctor</dt>
              <dd className="text-right font-medium text-text">
                {success.doctorName}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-border pb-2">
              <dt className="font-semibold text-text-subtle">Date</dt>
              <dd className="text-right font-medium text-text">
                {success.date}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="font-semibold text-text-subtle">Time</dt>
              <dd className="text-right font-medium text-text">
                {success.time}
              </dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={handleBookAnother}
            className="dh-btn-primary mt-8 w-full py-3.5 text-sm shadow-dh-card"
          >
            Book another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold tracking-tight text-text">
          Book appointment
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Schedule a visit with a doctor on staff.
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

      {loading ? (
        <div className="dh-card h-64 animate-pulse border-border bg-surface-2/50" />
      ) : doctors.length === 0 ? (
        <div className="dh-card px-6 py-12 text-center text-sm text-text-muted">
          No doctors found in staff. Add a staff member with the role{" "}
          <span className="font-semibold text-primary">doctor</span> to enable
          booking.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="dh-card space-y-5 p-5 sm:p-6">
          {submitError ? (
            <div
              role="alert"
              className="rounded-xl border border-danger/35 bg-[color-mix(in_srgb,var(--danger)_12%,var(--surface))] px-3 py-2 text-sm text-[#ffb4b4]"
            >
              {submitError}
            </div>
          ) : null}

          <div ref={patientFieldRef} className="relative flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-text-muted">
              Patient *
            </label>
            <input
              type="text"
              value={selectedPatient ? selectedPatient.name : patientQuery}
              onChange={(e) => {
                const v = e.target.value;
                setSelectedPatient(null);
                setPatientQuery(v);
                setPatientOpen(true);
              }}
              onFocus={() => setPatientOpen(true)}
              placeholder="Search by name or phone…"
              className="dh-input w-full px-4 py-2.5 text-sm"
              autoComplete="off"
            />
            {patientOpen && (patientQuery.trim().length > 0 || patientLoading) ? (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-auto rounded-xl border border-border bg-surface shadow-dh-card">
                {patientLoading ? (
                  <p className="px-3 py-3 text-sm text-text-muted">Searching…</p>
                ) : patientResults.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-text-muted">
                    No patients match.
                  </p>
                ) : (
                  <ul className="py-1">
                    {patientResults.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          className="flex w-full flex-col items-start px-3 py-2.5 text-left text-sm hover:bg-surface-2"
                          onClick={() => {
                            setSelectedPatient(p);
                            setPatientQuery(p.name);
                            setPatientOpen(false);
                          }}
                        >
                          <span className="font-semibold text-text">
                            {p.name}
                          </span>
                          <span className="text-xs text-text-muted">
                            {p.phone}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="book-doctor"
              className="text-xs font-bold uppercase tracking-wider text-text-muted"
            >
              Doctor *
            </label>
            <select
              id="book-doctor"
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              className="dh-input w-full px-4 py-2.5 text-sm"
            >
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="book-date"
                className="text-xs font-bold uppercase tracking-wider text-text-muted"
              >
                Date *
              </label>
              <input
                id="book-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="dh-input w-full px-4 py-2.5 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="book-time"
                className="text-xs font-bold uppercase tracking-wider text-text-muted"
              >
                Time *
              </label>
              <select
                id="book-time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="dh-input w-full px-4 py-2.5 text-sm"
              >
                {SLOTS.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="book-reason"
              className="text-xs font-bold uppercase tracking-wider text-text-muted"
            >
              Reason / chief complaint
            </label>
            <input
              id="book-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="dh-input w-full px-4 py-2.5 text-sm"
              placeholder="e.g. Cleaning, pain in lower left…"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="dh-btn-primary w-full py-3.5 text-sm shadow-dh-card"
          >
            {submitting ? "Booking…" : "Confirm booking"}
          </button>
        </form>
      )}
    </div>
  );
}
