import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { MapPin, Phone, Calendar, User, Building2, Clock } from "lucide-react";
import { api } from "../../services/api";
import { loadPatientQrByToken } from "../../data/qrRegistryStore";
import type { PatientQrData } from "../../utils/patientQr";

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof User;
  label: string;
  value: string;
}) {
  if (!value || value === "—") return null;
  return (
    <div className="flex gap-3 py-3 border-b border-slate-100 last:border-0">
      <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider m-0">{label}</p>
        <p className="text-sm font-semibold text-slate-800 m-0 mt-0.5 break-words">{value}</p>
      </div>
    </div>
  );
}

export function PatientQrPublicPage() {
  const { token } = useParams<{ token: string }>();
  const [patient, setPatient] = useState<PatientQrData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!token) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setNotFound(false);

      try {
        const res = await api.public.getPatientByToken(token);
        if (!cancelled && res.found && res.patient) {
          setPatient(res.patient);
          setLoading(false);
          return;
        }
      } catch {
        /* offline */
      }

      const local = loadPatientQrByToken(token);
      if (!cancelled && local) {
        setPatient(local);
        setLoading(false);
        return;
      }

      if (!cancelled) {
        setPatient(null);
        setNotFound(true);
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <header className="bg-[#1a2332] text-white px-4 py-5">
        <div className="max-w-lg mx-auto">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 m-0">
            Softone Hearing
          </p>
          <h1 className="text-xl font-bold m-0 mt-1">Appointment &amp; patient details</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center text-slate-500 text-sm">
            Loading patient information…
          </div>
        ) : notFound || !patient ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center stack gap-3">
            <p className="text-slate-700 font-semibold m-0">Record not found</p>
            <p className="text-sm text-slate-500 m-0">
              Token <span className="font-mono font-bold">{token}</span> is invalid or expired.
              Please contact the clinic.
            </p>
            <Link to="/login" className="text-sm text-blue-600 font-semibold">
              Staff login
            </Link>
          </div>
        ) : (
          <div className="stack gap-4">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-emerald-600 text-white px-5 py-4">
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-90 m-0">
                  Confirmed patient
                </p>
                <h2 className="text-2xl font-bold m-0 mt-1">{patient.patientName}</h2>
                <p className="text-xs font-mono mt-2 m-0 opacity-90">Token: {patient.qrToken}</p>
              </div>

              <div className="px-5 py-2">
                <DetailRow icon={Phone} label="Mobile" value={patient.mobileNumber} />
                <DetailRow icon={User} label="Patient ID" value={patient.patientId} />
                <DetailRow icon={Building2} label="City" value={patient.city ?? ""} />
                <DetailRow icon={Building2} label="Clinic branch" value={patient.assignedBranch ?? ""} />
                <DetailRow
                  icon={Calendar}
                  label="Appointment"
                  value={
                    patient.appointmentDate
                      ? `${patient.appointmentDate}${patient.appointmentSlot ? ` · ${patient.appointmentSlot}` : ""}`
                      : ""
                  }
                />
                <DetailRow
                  icon={Clock}
                  label="Status"
                  value={patient.status ? String(patient.status).replace(/_/g, " ") : ""}
                />
                {patient.notes?.trim() ? (
                  <div className="py-3 border-b border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider m-0">
                      Notes
                    </p>
                    <p className="text-sm text-slate-700 m-0 mt-1 leading-relaxed">{patient.notes}</p>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 px-5 py-4 stack gap-3">
              <h3 className="text-sm font-bold text-slate-800 m-0">Clinic contact</h3>
              <DetailRow icon={Phone} label="Clinic phone" value={patient.branchPhone ?? ""} />
              <DetailRow icon={MapPin} label="Address" value={patient.branchAddress ?? ""} />
              {patient.googleLocation ? (
                <a
                  href={patient.googleLocation}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl decoration-none transition-colors"
                >
                  <MapPin size={16} />
                  Open in Google Maps
                </a>
              ) : null}
            </div>

            <p className="text-center text-[11px] text-slate-400 m-0 pb-6">
              Present this screen at reception for check-in.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
