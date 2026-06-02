import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  normalizePatientProfile,
  patientKey,
  type PatientProfile,
  type PatientProfileInput,
} from "../types/patient";
import { loadPatientProfile, savePatientProfile } from "../data/patientProfileStore";
import { PatientDetailModal } from "../components/patient/PatientDetailModal";
import { PatientModalContext } from "./patientModalContext";

export function PatientModalProvider({ children }: { children: ReactNode }) {
  const [patient, setPatient] = useState<PatientProfile | null>(null);

  const openPatient = useCallback((input: PatientProfileInput) => {
    const normalized = normalizePatientProfile(input);
    const key = patientKey(normalized);
    const stored = loadPatientProfile(key);
    const merged = savePatientProfile({ ...(stored ?? {}), ...normalized });
    setPatient(merged);
  }, []);

  const closePatient = useCallback(() => setPatient(null), []);

  const updatePatient = useCallback((patch: Partial<PatientProfile>) => {
    setPatient((prev) => {
      if (!prev) return prev;
      return savePatientProfile({ ...prev, ...patch });
    });
  }, []);

  const value = useMemo(
    () => ({ patient, openPatient, closePatient, updatePatient }),
    [patient, openPatient, closePatient, updatePatient]
  );

  return (
    <PatientModalContext.Provider value={value}>
      {children}
      <PatientDetailModal />
    </PatientModalContext.Provider>
  );
}
