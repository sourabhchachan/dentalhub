export type Role = 'receptionist' | 'doctor' | 'admin'
export type AppointmentStatus = 'Scheduled' | 'Arrived' | 'In-chair' | 'Done' | 'No-show'
export interface Staff {
  id: string; staff_id: string; name: string; role: Role; department?: string
}
export interface Patient {
  id: string; name: string; phone: string; age?: number; blood_group?: string; created_at: string
  medical_notes?: string | null
}
export interface Appointment {
  id: string; patient_id: string; doctor_id: string; date: string; time: string
  status: AppointmentStatus; reason: string; created_at: string
  booked_by?: string | null
  patients?: Patient; staff?: Staff
}
export interface TreatmentRecord {
  id: string; appointment_id: string; patient_id: string; doctor_id: string
  tooth?: string; procedure: string; notes?: string; date: string
}
export interface Bill {
  id: string; patient_id: string; treatment_id?: string; total: number
  paid: boolean; payment_method?: string; created_at: string
  bill_lines?: BillLine[]
}
export interface BillLine {
  id: string; bill_id: string; description: string; amount: number
}
