import { createContext, useContext } from "react";
import type { PatientProfile, PatientProfileInput } from "../types/patient";

export interface PatientModalContextValue {
  patient: PatientProfile | null;
  openPatient: (input: PatientProfileInput) => void;
  closePatient: () => void;
  updatePatient: (patch: Partial<PatientProfile>) => void;
}

export const PatientModalContext = createContext<PatientModalContextValue | null>(null);

export function usePatientModal(): PatientModalContextValue {
  const ctx = useContext(PatientModalContext);
  if (!ctx) {
    throw new Error("usePatientModal must be used within PatientModalProvider");
  }
  return ctx;
}
