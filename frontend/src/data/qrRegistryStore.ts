import type { PatientQrData } from "../utils/patientQr";

const STORAGE_KEY = "softone.qr.registry";

function readAll(): Record<string, PatientQrData> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, PatientQrData>) : {};
  } catch {
    return {};
  }
}

function writeAll(data: Record<string, PatientQrData>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function registerPatientQrData(data: PatientQrData): void {
  const all = readAll();
  all[data.qrToken.trim().toUpperCase()] = data;
  writeAll(all);
}

export function loadPatientQrByToken(qrToken: string): PatientQrData | null {
  const key = qrToken.trim().toUpperCase();
  return readAll()[key] ?? null;
}
