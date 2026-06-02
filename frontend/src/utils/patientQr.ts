import { registerPatientQrData } from "../data/qrRegistryStore";
import { getBranchDetails } from "../data/branchDetails";
import type { PatientProfile } from "../types/patient";

/** Structured patient data (stored in DB + local registry; shown on public page) */
export interface PatientQrData {
  type: "softone_patient";
  version: 1;
  qrToken: string;
  patientId: string;
  patientName: string;
  mobileNumber: string;
  city?: string;
  source?: string;
  status?: string;
  appointmentStatus?: string;
  assignedBranch?: string;
  assignedAudiologist?: string;
  appointmentDate?: string;
  appointmentSlot?: string;
  notes?: string;
  priority?: string;
  stage?: string;
  lastCallTime?: string;
  branchPhone?: string;
  branchAddress?: string;
  googleLocation?: string;
  generatedAt: string;
}

/** Base URL patients land on when scanning QR (must be reachable from mobile). */
export function getPublicAppBaseUrl(): string {
  const envUrl = import.meta.env.VITE_PUBLIC_APP_URL as string | undefined;
  if (envUrl?.trim()) return envUrl.trim().replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "http://localhost:5173";
}

/** URL encoded inside the QR — opens patient details in the browser */
export function getPatientQrCodeUrl(qrToken: string): string {
  const base = getPublicAppBaseUrl();
  return `${base}/p/${encodeURIComponent(qrToken.trim())}`;
}

export function createQrToken(seed: number | string): string {
  const n = typeof seed === "number" ? seed : seed.length;
  return `QR-${new Date().getFullYear()}-${String(n + 1).padStart(4, "0")}`;
}

export function buildPatientQrData(profile: PatientProfile, qrToken: string): PatientQrData {
  const clinicName = profile.assignedBranch ?? profile.city ?? "Delhi Gate";
  const branch = getBranchDetails(clinicName);

  return {
    type: "softone_patient",
    version: 1,
    qrToken,
    patientId: profile.id,
    patientName: profile.patientName,
    mobileNumber: profile.mobileNumber,
    city: profile.city,
    source: profile.source,
    status: profile.status,
    appointmentStatus: profile.appointmentStatus,
    assignedBranch: clinicName,
    assignedAudiologist: profile.assignedAudiologist,
    appointmentDate: profile.nextFollowUpDate,
    appointmentSlot: profile.nextFollowUpTime,
    notes: profile.notes,
    priority: profile.priority,
    stage: profile.stage,
    lastCallTime: profile.lastCallTime,
    branchPhone: branch.phone,
    branchAddress: branch.address,
    googleLocation: branch.locationLink,
    generatedAt: new Date().toISOString(),
  };
}

/** Full JSON saved to database `qr_payload` column */
export function buildQrPayloadForPatient(profile: PatientProfile, qrToken: string): string {
  return JSON.stringify(buildPatientQrData(profile, qrToken));
}

/** Value for QRCodeCanvas — always a public https/http link */
export function getQrCanvasValue(_profile: PatientProfile, qrToken: string): string {
  return getPatientQrCodeUrl(qrToken);
}

export function parsePatientQrPayload(raw: string): PatientQrData | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const data = JSON.parse(trimmed) as Partial<PatientQrData>;
    if (data.qrToken && data.patientName) {
      return data as PatientQrData;
    }
  } catch {
    /* not JSON */
  }

  return null;
}

/** Extract qr token from URL, JSON payload, or plain token text */
export function extractQrTokenFromScan(scan: string): string {
  const trimmed = scan.trim();
  const parsed = parsePatientQrPayload(trimmed);
  if (parsed?.qrToken) return parsed.qrToken;

  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter(Boolean);
    const pIndex = parts.indexOf("p");
    if (pIndex >= 0 && parts[pIndex + 1]) {
      return decodeURIComponent(parts[pIndex + 1]);
    }
  } catch {
    /* not a URL */
  }

  return trimmed;
}

/** Save registry + return payload JSON and scan URL */
export function persistPatientQr(profile: PatientProfile, qrToken: string) {
  const data = buildPatientQrData(profile, qrToken);
  registerPatientQrData(data);
  return {
    data,
    payload: JSON.stringify(data),
    url: getPatientQrCodeUrl(qrToken),
  };
}

export function telecallerEntryToQrData(entry: {
  id: string;
  patientName: string;
  mobileNumber: string;
  city?: string;
  clinicName?: string;
  appointmentDate?: string;
  appointmentSlot?: string;
  callNotes?: string;
  qrToken?: string | null;
  qrPayload?: string | null;
}): PatientQrData | null {
  if (entry.qrPayload) {
    const parsed = parsePatientQrPayload(entry.qrPayload);
    if (parsed) return parsed;
  }
  if (!entry.qrToken) return null;
  return buildPatientQrData(
    {
      id: entry.id,
      patientName: entry.patientName,
      mobileNumber: entry.mobileNumber,
      city: entry.city,
      assignedBranch: entry.clinicName,
      nextFollowUpDate: entry.appointmentDate,
      nextFollowUpTime: entry.appointmentSlot,
      notes: entry.callNotes,
    },
    entry.qrToken
  );
}
