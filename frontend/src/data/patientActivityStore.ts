export interface PatientActivityLog {
  id: string;
  action: string;
  detail: string;
  at: string;
  by?: string;
}

const STORAGE_KEY = "softone.patient.activity_logs";

function readAll(): Record<string, PatientActivityLog[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, PatientActivityLog[]>) : {};
  } catch {
    return {};
  }
}

function writeAll(data: Record<string, PatientActivityLog[]>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getPatientLogs(key: string): PatientActivityLog[] {
  return readAll()[key] ?? [];
}

export function appendPatientLog(
  key: string,
  entry: Omit<PatientActivityLog, "id" | "at"> & { at?: string }
): PatientActivityLog[] {
  const all = readAll();
  const list = all[key] ?? [];
  const row: PatientActivityLog = {
    id: `LOG-${Date.now()}`,
    at: entry.at ?? new Date().toISOString(),
    action: entry.action,
    detail: entry.detail,
    by: entry.by,
  };
  const next = [row, ...list];
  all[key] = next;
  writeAll(all);
  return next;
}
