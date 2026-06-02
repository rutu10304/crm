import clsx from "clsx";
import type { ReactNode } from "react";
import { usePatientModal } from "../../context/patientModalContext";
import type { PatientProfileInput } from "../../types/patient";

interface PatientNameButtonProps {
  patient: PatientProfileInput;
  className?: string;
  children?: ReactNode;
}

export function PatientNameButton({ patient, className, children }: PatientNameButtonProps) {
  const { openPatient } = usePatientModal();
  const label = children ?? patient.patientName ?? patient.name ?? "Patient";

  return (
    <button
      type="button"
      className={clsx(
        "patient-name-link inline text-left font-bold text-slate-800 hover:text-blue-600",
        "underline-offset-2 hover:underline cursor-pointer bg-transparent border-none p-0",
        className
      )}
      onClick={(e) => {
        e.stopPropagation();
        openPatient(patient);
      }}
    >
      {label}
    </button>
  );
}
