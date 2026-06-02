import type { PatientProfile } from "../types/patient";
import { normalizePatientProfile, patientKey } from "../types/patient";

const STORAGE_KEY = "softone.patient.profiles";

function readAll(): Record<string, PatientProfile> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, PatientProfile>) : {};
  } catch {
    return {};
  }
}

function writeAll(data: Record<string, PatientProfile>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function savePatientProfile(profile: PatientProfile): PatientProfile {
  const normalized = normalizePatientProfile(profile);
  const key = patientKey(normalized);
  const all = readAll();
  all[key] = { ...all[key], ...normalized };
  writeAll(all);
  return all[key];
}

export function loadPatientProfile(key: string): PatientProfile | null {
  return readAll()[key] ?? null;
}
