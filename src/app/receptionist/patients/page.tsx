"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Patient } from "@/types";

type PatientRow = Patient & { medical_notes?: string | null };

function buildAppointmentCounts(
  rows: { patient_id: string }[] | null
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows ?? []) {
    const id = row.patient_id;
    if (!id) continue;
    map.set(id, (map.get(id) ?? 0) + 1);
  }
  return map;
}

export default function ReceptionistPatientsPage() {
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    age: "",
    blood_group: "",
    medical_notes: "",
  });

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const [patRes, aptRes] = await Promise.all([
      supabase.from("patients").select("*").order("name", { ascending: true }),
      supabase.from("appointments").select("patient_id"),
    ]);

    if (patRes.error) {
      setError(patRes.error.message);
      setPatients([]);
      setCounts(new Map());
      return;
    }
    if (aptRes.error) {
      setError(aptRes.error.message);
      setPatients([]);
      setCounts(new Map());
      return;
    }

    setPatients((patRes.data ?? []) as PatientRow[]);
    setCounts(buildAppointmentCounts(aptRes.data));
    setError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await loadData();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadData]);

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen]);

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

  async function handleAddPatient(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const name = form.name.trim();
    const phone = form.phone.trim();
    if (!name || !phone) {
      setFormError("Name and phone are required.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const ageNum = form.age.trim() === "" ? null : Number(form.age);
    const payload = {
      name,
      phone,
      age: ageNum != null && !Number.isNaN(ageNum) ? ageNum : null,
      blood_group: form.blood_group.trim() || null,
      medical_notes: form.medical_notes.trim() || null,
    };

    const { error: insError } = await supabase.from("patients").insert(payload);

    if (insError) {
      setFormError(insError.message);
      setSaving(false);
      return;
    }

    setForm({
      name: "",
      phone: "",
      age: "",
      blood_group: "",
      medical_notes: "",
    });
    setModalOpen(false);
    await loadData();
    setSaving(false);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-text">
            Patients
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Directory · {patients.length} on file
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setFormError(null);
            setModalOpen(true);
          }}
          className="dh-btn-primary shrink-0 px-4 py-2.5 text-sm shadow-dh-card"
        >
          Add Patient
        </button>
      </div>

      <div className="relative">
        <label htmlFor="patient-search" className="sr-only">
          Search patients
        </label>
        <input
          id="patient-search"
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
              className="h-28 animate-pulse rounded-[16px] border border-border bg-surface"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="dh-card flex flex-col items-center justify-center px-6 py-16 text-center">
          <span className="text-[48px] leading-none" aria-hidden>
            🦷
          </span>
          <p className="font-display mt-5 text-lg font-bold text-text">
            {patients.length === 0 ? "No patients yet" : "No matches"}
          </p>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-text-muted">
            {patients.length === 0
              ? "Add your first patient to start building the chart."
              : "Try a different name or phone number."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((p) => {
            const n = counts.get(p.id) ?? 0;
            return (
              <li key={p.id} className="dh-card border-l-4 border-l-primary p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-lg font-bold text-text">
                      {p.name}
                    </p>
                    <p className="mt-1 text-sm font-medium text-text-muted">
                      {p.phone}
                    </p>
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
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                      Appointments
                    </p>
                    <p className="font-display text-2xl font-bold text-primary">
                      {n}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
            aria-label="Close modal"
            onClick={() => !saving && setModalOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-patient-title"
            className="relative z-10 max-h-[min(90vh,640px)] w-full max-w-lg sm:rounded-[16px]"
          >
            <div className="dh-card flex max-h-[min(90vh,640px)] flex-col overflow-hidden rounded-b-none border-b-0 sm:rounded-b-[16px] sm:border-b">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <h2
                  id="add-patient-title"
                  className="font-display text-lg font-bold text-text"
                >
                  Add patient
                </h2>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setModalOpen(false)}
                  className="dh-btn-ghost rounded-lg px-3 py-1.5 text-xs"
                >
                  Close
                </button>
              </div>
              <form
                onSubmit={handleAddPatient}
                className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5"
              >
                {formError ? (
                  <div
                    role="alert"
                    className="rounded-xl border border-danger/35 bg-[color-mix(in_srgb,var(--danger)_12%,var(--surface))] px-3 py-2 text-sm text-[#ffb4b4]"
                  >
                    {formError}
                  </div>
                ) : null}

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-text-muted">
                    Name *
                  </label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                    className="dh-input w-full px-4 py-2.5 text-sm"
                    placeholder="Full name"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-text-muted">
                    Phone *
                  </label>
                  <input
                    required
                    value={form.phone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, phone: e.target.value }))
                    }
                    className="dh-input w-full px-4 py-2.5 text-sm"
                    placeholder="+91 …"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-text-muted">
                      Age
                    </label>
                    <input
                      inputMode="numeric"
                      value={form.age}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, age: e.target.value }))
                      }
                      className="dh-input w-full px-4 py-2.5 text-sm"
                      placeholder="—"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-text-muted">
                      Blood group
                    </label>
                    <input
                      value={form.blood_group}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, blood_group: e.target.value }))
                      }
                      className="dh-input w-full px-4 py-2.5 text-sm"
                      placeholder="e.g. O+"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-text-muted">
                    Medical notes
                  </label>
                  <textarea
                    rows={3}
                    value={form.medical_notes}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, medical_notes: e.target.value }))
                    }
                    className="dh-input w-full resize-none px-4 py-2.5 text-sm"
                    placeholder="Allergies, conditions, medications…"
                  />
                </div>

                <div className="mt-2 flex gap-3 border-t border-border pt-4">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setModalOpen(false)}
                    className="dh-btn-ghost flex-1 py-3 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="dh-btn-primary flex-1 py-3 text-sm shadow-dh-card"
                  >
                    {saving ? "Saving…" : "Save patient"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
