"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Bill, BillLine } from "@/types";

type PatientPick = { id: string; name: string; phone: string };

type BillRow = Bill & {
  patients: { name: string } | null;
  bill_lines: BillLine[] | null;
};

const PAYMENT_METHODS = ["Cash", "UPI", "Card", "Insurance"] as const;

function escapeIlike(q: string): string {
  return q.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function pickPatient(rel: unknown): { name: string } | null {
  if (rel == null) return null;
  if (Array.isArray(rel)) {
    const first = rel[0] as { name?: string } | undefined;
    return first ? { name: first.name ?? "" } : null;
  }
  if (typeof rel === "object" && "name" in rel) {
    return { name: String((rel as { name?: string }).name ?? "") };
  }
  return null;
}

function pickLines(rel: unknown): BillLine[] {
  if (!rel) return [];
  if (Array.isArray(rel)) return rel as BillLine[];
  return [rel as BillLine];
}

function normalizeBill(raw: Record<string, unknown>): BillRow {
  return {
    id: String(raw.id),
    patient_id: String(raw.patient_id),
    treatment_id: raw.treatment_id ? String(raw.treatment_id) : undefined,
    total: Number(raw.total),
    paid: Boolean(raw.paid),
    payment_method: raw.payment_method
      ? String(raw.payment_method)
      : undefined,
    created_at: String(raw.created_at ?? ""),
    patients: pickPatient(raw.patients),
    bill_lines: pickLines(raw.bill_lines),
  };
}

export default function AdminBillingPage() {
  const [bills, setBills] = useState<BillRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const patientFieldRef = useRef<HTMLDivElement>(null);
  const [patientQuery, setPatientQuery] = useState("");
  const [patientOpen, setPatientOpen] = useState(false);
  const [patientResults, setPatientResults] = useState<PatientPick[]>([]);
  const [patientLoading, setPatientLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientPick | null>(
    null
  );

  const [lines, setLines] = useState<{ description: string; amount: string }[]>(
    [{ description: "", amount: "" }]
  );
  const [paymentMethod, setPaymentMethod] =
    useState<(typeof PAYMENT_METHODS)[number]>("Cash");

  const loadBills = useCallback(async () => {
    const supabase = createClient();
    const { data, error: qErr } = await supabase
      .from("bills")
      .select(
        `
        id,
        patient_id,
        treatment_id,
        total,
        paid,
        payment_method,
        created_at,
        patients ( name ),
        bill_lines ( id, bill_id, description, amount )
      `
      )
      .order("created_at", { ascending: false });

    if (qErr) {
      setError(qErr.message);
      setBills([]);
      return;
    }
    const list = (data ?? []).map((r) =>
      normalizeBill(r as Record<string, unknown>)
    );
    list.sort((a, b) => {
      if (a.paid !== b.paid) return a.paid ? 1 : -1;
      return b.created_at.localeCompare(a.created_at);
    });
    setBills(list);
    setError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await loadBills();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadBills]);

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
    }, 200);
    return () => clearTimeout(t);
  }, [patientQuery, patientOpen, selectedPatient]);

  useEffect(() => {
    if (!patientOpen) return;
    function handlePointerDown(e: PointerEvent) {
      const el = patientFieldRef.current;
      if (el && !el.contains(e.target as Node)) setPatientOpen(false);
    }
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [patientOpen]);

  const totals = useMemo(() => {
    let collected = 0;
    let pending = 0;
    for (const b of bills) {
      if (b.paid) collected += b.total;
      else pending += b.total;
    }
    return { collected, pending };
  }, [bills]);

  const lineTotal = useMemo(() => {
    return lines.reduce((sum, l) => {
      const n = parseFloat(l.amount);
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0);
  }, [lines]);

  async function markPaid(id: string) {
    const supabase = createClient();
    const { error: uErr } = await supabase
      .from("bills")
      .update({ paid: true })
      .eq("id", id);
    if (uErr) {
      setError(uErr.message);
      return;
    }
    await loadBills();
  }

  async function handleCreateBill(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!selectedPatient) {
      setFormError("Select a patient.");
      return;
    }
    const cleaned = lines
      .map((l) => ({
        description: l.description.trim(),
        amount: parseFloat(l.amount),
      }))
      .filter((l) => l.description && Number.isFinite(l.amount) && l.amount > 0);
    if (cleaned.length === 0) {
      setFormError("Add at least one line item with a valid amount.");
      return;
    }
    const total = cleaned.reduce((s, l) => s + l.amount, 0);

    setSaving(true);
    const supabase = createClient();
    const { data: billRow, error: bErr } = await supabase
      .from("bills")
      .insert({
        patient_id: selectedPatient.id,
        total,
        paid: false,
        payment_method: paymentMethod,
      })
      .select("id")
      .single();

    if (bErr || !billRow) {
      setFormError(bErr?.message ?? "Could not create bill.");
      setSaving(false);
      return;
    }

    const billId = String(billRow.id);
    const { error: lErr } = await supabase.from("bill_lines").insert(
      cleaned.map((l) => ({
        bill_id: billId,
        description: l.description,
        amount: l.amount,
      }))
    );

    if (lErr) {
      setFormError(lErr.message);
      setSaving(false);
      return;
    }

    setModalOpen(false);
    setSelectedPatient(null);
    setPatientQuery("");
    setLines([{ description: "", amount: "" }]);
    setPaymentMethod("Cash");
    await loadBills();
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-text">
            Billing
          </h1>
          <p className="mt-1 text-sm text-text-muted">Invoices & collections</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setFormError(null);
            setModalOpen(true);
          }}
          className="dh-btn-primary shrink-0 px-4 py-2.5 text-sm shadow-dh-card"
        >
          New bill
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="dh-stat-card flex flex-col p-3.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
            Collected
          </span>
          {loading ? (
            <div className="mt-2 h-9 w-20 animate-pulse rounded-lg bg-border" />
          ) : (
            <span className="font-display mt-1 text-2xl font-bold text-primary">
              ₹{totals.collected.toFixed(0)}
            </span>
          )}
        </div>
        <div className="dh-stat-card flex flex-col p-3.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
            Pending
          </span>
          {loading ? (
            <div className="mt-2 h-9 w-20 animate-pulse rounded-lg bg-border" />
          ) : (
            <span className="font-display mt-1 text-2xl font-bold text-primary">
              ₹{totals.pending.toFixed(0)}
            </span>
          )}
        </div>
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
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-[16px] border border-border bg-surface"
            />
          ))}
        </div>
      ) : bills.length === 0 ? (
        <div className="dh-card px-6 py-14 text-center text-sm text-text-muted">
          No bills yet. Create one with{" "}
          <span className="font-semibold text-primary">New bill</span>.
        </div>
      ) : (
        <ul className="space-y-4">
          {bills.map((b) => {
            const pname = b.patients?.name ?? "Patient";
            const descs = (b.bill_lines ?? [])
              .map((l) => l.description)
              .filter(Boolean);
            return (
              <li key={b.id} className="dh-card border-l-4 border-l-primary p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-lg font-bold text-text">
                      {pname}
                    </p>
                    <p className="mt-1 text-xs text-text-muted">
                      {new Date(b.created_at).toLocaleString()}
                    </p>
                    <ul className="mt-2 list-inside list-disc text-sm text-text-muted">
                      {descs.length ? (
                        descs.map((d, i) => <li key={i}>{d}</li>)
                      ) : (
                        <li>—</li>
                      )}
                    </ul>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-xl font-bold text-primary">
                      ₹{b.total.toFixed(0)}
                    </p>
                    <span
                      className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ${
                        b.paid
                          ? "bg-surface-2 text-emerald-300 ring-emerald-500/25"
                          : "bg-surface-2 text-amber-300 ring-amber-500/25"
                      }`}
                    >
                      {b.paid ? "Paid" : "Unpaid"}
                    </span>
                    {b.paid && b.payment_method ? (
                      <p className="mt-2 text-xs text-text-muted">
                        {b.payment_method}
                      </p>
                    ) : null}
                  </div>
                </div>
                {!b.paid ? (
                  <button
                    type="button"
                    onClick={() => void markPaid(b.id)}
                    className="dh-btn-primary mt-4 w-full py-2.5 text-xs shadow-dh-card sm:w-auto sm:px-6"
                  >
                    Mark paid
                  </button>
                ) : null}
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
            aria-label="Close"
            onClick={() => !saving && setModalOpen(false)}
          />
          <div className="relative z-10 max-h-[min(92vh,720px)] w-full max-w-lg sm:rounded-[16px]">
            <div className="dh-card flex max-h-[min(92vh,720px)] flex-col overflow-hidden rounded-b-none sm:rounded-b-[16px]">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <h2 className="font-display text-lg font-bold text-text">
                  New bill
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
                onSubmit={handleCreateBill}
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

                <div ref={patientFieldRef} className="relative flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-text-muted">
                    Patient *
                  </label>
                  <input
                    type="text"
                    value={selectedPatient ? selectedPatient.name : patientQuery}
                    onChange={(e) => {
                      setSelectedPatient(null);
                      setPatientQuery(e.target.value);
                      setPatientOpen(true);
                    }}
                    onFocus={() => setPatientOpen(true)}
                    placeholder="Search name or phone…"
                    className="dh-input w-full px-4 py-2.5 text-sm"
                    autoComplete="off"
                  />
                  {patientOpen &&
                  (patientQuery.trim().length > 0 || patientLoading) ? (
                    <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-auto rounded-xl border border-border bg-surface shadow-dh-card">
                      {patientLoading ? (
                        <p className="px-3 py-3 text-sm text-text-muted">
                          Searching…
                        </p>
                      ) : patientResults.length === 0 ? (
                        <p className="px-3 py-3 text-sm text-text-muted">
                          No matches.
                        </p>
                      ) : (
                        <ul className="py-1">
                          {patientResults.map((p) => (
                            <li key={p.id}>
                              <button
                                type="button"
                                className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-surface-2"
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

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
                      Line items
                    </span>
                    <button
                      type="button"
                      className="text-xs font-bold text-primary hover:underline"
                      onClick={() =>
                        setLines((ls) => [...ls, { description: "", amount: "" }])
                      }
                    >
                      + Add line
                    </button>
                  </div>
                  {lines.map((line, idx) => (
                    <div key={idx} className="grid grid-cols-1 gap-2 sm:grid-cols-5">
                      <input
                        className="dh-input sm:col-span-3 px-3 py-2 text-sm"
                        placeholder="Description"
                        value={line.description}
                        onChange={(e) =>
                          setLines((ls) =>
                            ls.map((x, i) =>
                              i === idx ? { ...x, description: e.target.value } : x
                            )
                          )
                        }
                      />
                      <input
                        className="dh-input sm:col-span-2 px-3 py-2 text-sm"
                        inputMode="decimal"
                        placeholder="Amount"
                        value={line.amount}
                        onChange={(e) =>
                          setLines((ls) =>
                            ls.map((x, i) =>
                              i === idx ? { ...x, amount: e.target.value } : x
                            )
                          )
                        }
                      />
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border bg-surface-2 px-4 py-3">
                  <span className="text-xs font-bold uppercase text-text-muted">
                    Total
                  </span>
                  <span className="font-display text-lg font-bold text-primary">
                    ₹{lineTotal.toFixed(2)}
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-text-muted">
                    Payment method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) =>
                      setPaymentMethod(e.target.value as (typeof PAYMENT_METHODS)[number])
                    }
                    className="dh-input w-full px-4 py-2.5 text-sm"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-3 border-t border-border pt-4">
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
                    {saving ? "Saving…" : "Create bill"}
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
