export type PatientLifecycleStatus =
  | "new_lead"
  | "not_answered"
  | "callback_requested"
  | "interested"
  | "appointment_booked"
  | "visited"
  | "trial_started"
  | "converted"
  | "lost"
  | "spam"
  | "active"
  | "follow_up"
  | "trial"
  | "completed"
  | string;

export interface PatientProfile {
  id: string;
  patientName: string;
  mobileNumber: string;
  city?: string;
  source?: string;
  status?: PatientLifecycleStatus;
  appointmentStatus?: string;
  assignedBranch?: string;
  assignedAudiologist?: string;
  stage?: string;
  notes?: string;
  lastCallTime?: string;
  nextFollowUpDate?: string;
  nextFollowUpTime?: string;
  priority?: string;
  callConnected?: boolean;
  callReason?: string;
  salesPerson?: string;
  remark?: string;
  reference?: string;
  qrToken?: string | null;
  qrPayload?: string | null;
  createdAt?: string;
}

export type PatientProfileInput = Partial<PatientProfile> & {
  patientName?: string;
  name?: string;
  mobileNumber?: string;
  phone?: string;
};

export function patientKey(profile: Pick<PatientProfile, "id" | "mobileNumber">): string {
  const digits = profile.mobileNumber.replace(/\D/g, "");
  return profile.id || digits || profile.mobileNumber;
}

export function normalizePatientProfile(input: PatientProfileInput): PatientProfile {
  const patientName = (input.patientName ?? input.name ?? "Unknown Patient").trim();
  const mobileNumber = (input.mobileNumber ?? input.phone ?? "").trim();
  const id =
    input.id?.trim() ||
    (mobileNumber ? `PT-${mobileNumber.replace(/\D/g, "").slice(-10)}` : `PT-${Date.now()}`);

  return {
    id,
    patientName,
    mobileNumber,
    city: input.city,
    source: input.source,
    status: input.status ?? "new_lead",
    appointmentStatus: input.appointmentStatus,
    assignedBranch: input.assignedBranch ?? input.city,
    assignedAudiologist: input.assignedAudiologist,
    stage: input.stage,
    notes: input.notes,
    lastCallTime: input.lastCallTime,
    nextFollowUpDate: input.nextFollowUpDate,
    nextFollowUpTime: input.nextFollowUpTime,
    priority: input.priority,
    callConnected: input.callConnected ?? true,
    callReason: input.callReason,
    salesPerson: input.salesPerson,
    remark: input.remark ?? input.notes,
    reference: input.reference,
    qrToken: input.qrToken ?? null,
    qrPayload: input.qrPayload ?? null,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}
