import { useEffect, useMemo, useState, type ReactNode } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  User,
  Activity,
  ScrollText,
  QrCode,
  Copy,
  Download,
  Share2,
  Phone,
  MapPin,
} from "lucide-react";
import { usePatientModal } from "../../context/patientModalContext";
import { useToast } from "../../layout/ToastProvider";
import { useAuth } from "../../auth/AuthContext";
import { getBranchDetails } from "../../data/branchDetails";
import { appendPatientLog, getPatientLogs } from "../../data/patientActivityStore";
import {
  buildPatientQrData,
  createQrToken,
  getPatientQrCodeUrl,
  getQrCanvasValue,
  parsePatientQrPayload,
  persistPatientQr,
} from "../../utils/patientQr";
import { buildPatientWhatsAppMessage, sharePatientQrToWhatsApp } from "../../utils/whatsappShare";
import { patientKey, type PatientLifecycleStatus } from "../../types/patient";

const QR_CANVAS_ID = "patient-modal-qr-canvas";

const CALL_REASONS = [
  "Interested in trial",
  "Price enquiry",
  "Callback requested",
  "Not interested",
  "Wrong number",
  "Appointment booked",
  "Doctor referral",
  "Other",
] as const;

const PIPELINE_STATUS_OPTIONS = [
  "Start",
  "In Progress",
  "Follow-up",
  "Appointment",
  "Trial",
  "Converted",
  "Closed",
] as const;

const SOURCE_OPTIONS = [
  "Newspaper",
  "Google Ads",
  "Facebook Campaign",
  "Instagram Lead",
  "Doctor Referral",
  "Website Form",
  "Walk-in",
  "Manual Outbound",
  "Other",
] as const;

const SALES_PERSON_OPTIONS = [
  "SHITAL PATEL",
  "Dr. Mehta",
  "Dr. Sharma",
  "Branch Manager",
] as const;

type TabId = "detail" | "status" | "logs" | "qr";

const TABS: { id: TabId; label: string; icon: typeof User }[] = [
  { id: "detail", label: "Detail", icon: User },
  { id: "status", label: "Status", icon: Activity },
  { id: "logs", label: "Logs", icon: ScrollText },
  { id: "qr", label: "QR Code", icon: QrCode },
];

export function PatientDetailModal() {
  const { patient, closePatient, updatePatient } = usePatientModal();
  const { pushToast } = useToast();
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("detail");
  const [logs, setLogs] = useState(() => (patient ? getPatientLogs(patientKey(patient)) : []));
  const [callConnected, setCallConnected] = useState(true);
  const [callReason, setCallReason] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [pipelineStatus, setPipelineStatus] = useState("Start");
  const [sourceDraft, setSourceDraft] = useState("Newspaper");
  const [salesPerson, setSalesPerson] = useState("SHITAL PATEL");
  const [remarkDraft, setRemarkDraft] = useState("");
  const [referenceDraft, setReferenceDraft] = useState("");

  useEffect(() => {
    if (!patient) return;
    setActiveTab("detail");
    setCallConnected(patient.callConnected !== false);
    setCallReason(patient.callReason ?? "");
    setFollowUpDate(patient.nextFollowUpDate ?? "");
    setPipelineStatus(patient.stage ?? "Start");
    setSourceDraft(patient.source ?? "Manual Outbound");
    setSalesPerson(
      patient.salesPerson ?? session?.fullName?.toUpperCase() ?? "SHITAL PATEL"
    );
    setRemarkDraft(patient.remark ?? patient.notes ?? "");
    setReferenceDraft(patient.reference ?? "");
    const key = patientKey(patient);
    const existing = getPatientLogs(key);
    if (existing.length === 0) {
      appendPatientLog(key, {
        action: "Profile opened",
        detail: `Viewed patient record for ${patient.patientName}`,
        by: session?.fullName,
      });
    }
    setLogs(getPatientLogs(key));
  }, [patient, session?.fullName]);

  const branch = useMemo(
    () => getBranchDetails(patient?.assignedBranch ?? patient?.city ?? "Delhi Gate"),
    [patient]
  );

  const key = patient ? patientKey(patient) : "";
  const hasQr = Boolean(patient?.qrToken);
  const qrToken = patient?.qrToken ?? "";
  const qrCanvasValue = patient && qrToken ? getQrCanvasValue(patient, qrToken) : "";
  const qrPageUrl = qrToken ? getPatientQrCodeUrl(qrToken) : "";
  const qrData = useMemo(() => {
    if (!patient?.qrPayload) return patient && qrToken ? buildPatientQrData(patient, qrToken) : null;
    return parsePatientQrPayload(patient.qrPayload);
  }, [patient, qrToken]);

  if (!patient) return null;

  function refreshLogs() {
    setLogs(getPatientLogs(key));
  }

  function resolveLifecycleStatus(): PatientLifecycleStatus {
    if (!callConnected) return "not_answered";
    if (callReason === "Appointment booked") return "appointment_booked";
    if (callReason === "Callback requested") return "callback_requested";
    if (callReason === "Interested in trial") return "interested";
    if (callReason === "Not interested" || callReason === "Wrong number") return "lost";
    if (pipelineStatus === "Converted") return "converted";
    if (pipelineStatus === "Trial") return "trial_started";
    if (pipelineStatus === "Appointment") return "appointment_booked";
    return "callback_requested";
  }

  function saveStatus() {
    if (!followUpDate.trim()) {
      pushToast("Follow Up Date is required.", "error");
      return;
    }
    if (!callReason.trim()) {
      pushToast("Please select a reason.", "error");
      return;
    }

    const lifecycleStatus = resolveLifecycleStatus();
    updatePatient({
      status: lifecycleStatus,
      callConnected,
      callReason,
      stage: pipelineStatus,
      source: sourceDraft,
      salesPerson,
      remark: remarkDraft,
      reference: referenceDraft,
      notes: remarkDraft,
      nextFollowUpDate: followUpDate,
    });
    appendPatientLog(key, {
      action: "Status updated",
      detail: `${callConnected ? "Connected" : "Not connected"} · ${callReason} · ${pipelineStatus}`,
      by: session?.fullName,
    });
    refreshLogs();
    pushToast("Patient status saved.", "success");
  }

  async function generateQrAndSend() {
    const qrToken = patient!.qrToken ?? createQrToken(key);
    const { payload: qrPayload } = persistPatientQr(
      { ...patient!, appointmentStatus: patient!.appointmentStatus ?? "booked" },
      qrToken
    );
    updatePatient({ qrToken, qrPayload, appointmentStatus: patient!.appointmentStatus ?? "booked" });
    appendPatientLog(key, {
      action: "QR generated",
      detail: `Token ${qrToken} created and sent to WhatsApp`,
      by: session?.fullName,
    });
    refreshLogs();
    setActiveTab("qr");

    await new Promise((r) => setTimeout(r, 350));

    const updated = { ...patient!, qrToken, qrPayload };
    const message = buildPatientWhatsAppMessage(updated);

    if (!patient!.mobileNumber?.trim()) {
      pushToast("No mobile number on file for WhatsApp.", "error");
      return;
    }

    await sharePatientQrToWhatsApp({
      canvasId: QR_CANVAS_ID,
      mobileNumber: patient!.mobileNumber,
      message,
      onSuccess: (msg) => pushToast(msg, "success"),
      onError: (msg) => pushToast(msg, "error"),
    });
  }

  function copyCanvas() {
    const canvas = document.getElementById(QR_CANVAS_ID) as HTMLCanvasElement | null;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]).then(() => {
        pushToast("QR image copied.", "success");
      });
    });
  }

  function downloadCanvas() {
    const canvas = document.getElementById(QR_CANVAS_ID) as HTMLCanvasElement | null;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `patient-qr-${patient!.id}.png`;
    a.click();
    pushToast("QR downloaded.", "success");
  }

  async function resendWhatsApp() {
    if (!patient?.qrPayload) {
      pushToast("Generate QR first.", "info");
      return;
    }
    await sharePatientQrToWhatsApp({
      canvasId: QR_CANVAS_ID,
      mobileNumber: patient.mobileNumber,
      message: buildPatientWhatsAppMessage(patient!),
      onSuccess: (msg) => pushToast(msg, "success"),
      onError: (msg) => pushToast(msg, "error"),
    });
  }

  return (
    <AnimatePresence mode="wait">
      {patient ? (
      <div
        className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
        onClick={closePatient}
        role="presentation"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="patient-modal-title"
        >
          <header className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-100 bg-slate-50/80">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest m-0">
                Patient profile
              </p>
              <h2 id="patient-modal-title" className="text-lg font-bold text-slate-900 m-0 mt-0.5">
                {patient.patientName}
              </h2>
              <p className="text-xs text-slate-500 m-0 mt-1 font-mono">{patient.id}</p>
            </div>
            <button
              type="button"
              onClick={closePatient}
              className="p-2 rounded-lg hover:bg-slate-200/80 text-slate-500 border-none bg-transparent cursor-pointer"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </header>

          <nav className="flex gap-1 px-4 pt-3 border-b border-slate-100 overflow-x-auto">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? "border-teal-500 text-teal-700 bg-teal-50/40"
                      : "border-transparent text-slate-500 hover:text-slate-800 bg-transparent"
                  }`}
                >
                  <Icon size={14} />
                  {tab.label}
                </button>
              );
            })}
          </nav>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {activeTab === "detail" && (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 m-0 text-sm">
                <DetailItem label="Mobile" value={patient.mobileNumber} />
                <DetailItem label="City" value={patient.city ?? "—"} />
                <DetailItem label="Source" value={patient.source ?? "—"} />
                <DetailItem label="Branch" value={patient.assignedBranch ?? "—"} />
                <DetailItem label="Stage" value={patient.stage ?? "—"} />
                <DetailItem label="Priority" value={patient.priority ?? "—"} />
                <DetailItem
                  label="Follow-up"
                  value={
                    patient.nextFollowUpDate
                      ? `${patient.nextFollowUpDate} ${patient.nextFollowUpTime ?? ""}`.trim()
                      : "—"
                  }
                />
                <DetailItem label="Last call" value={patient.lastCallTime ?? "—"} />
                <div className="sm:col-span-2">
                  <dt className="text-[10px] font-bold text-slate-400 uppercase tracking-wider m-0">
                    Notes
                  </dt>
                  <dd className="mt-1 m-0 text-slate-700 leading-relaxed">
                    {patient.notes?.trim() || "No notes recorded."}
                  </dd>
                </div>
                <div className="sm:col-span-2 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600 stack gap-2">
                  <div className="flex items-center gap-2">
                    <Phone size={12} className="text-blue-500 shrink-0" />
                    {branch.phone}
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin size={12} className="text-blue-500 shrink-0 mt-0.5" />
                    <span>{branch.address}</span>
                  </div>
                </div>
              </dl>
            )}

            {activeTab === "status" && (
              <form
                className="stack gap-4 max-w-lg"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveStatus();
                }}
              >
                <fieldset className="border-0 p-0 m-0">
                  <legend className="sr-only">Call connection</legend>
                  <div className="flex flex-wrap gap-6">
                    <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700">
                      <input
                        type="radio"
                        name="call-connection"
                        checked={callConnected}
                        onChange={() => setCallConnected(true)}
                        className="w-4 h-4 text-teal-600 border-slate-300 focus:ring-teal-500"
                      />
                      Connected
                    </label>
                    <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700">
                      <input
                        type="radio"
                        name="call-connection"
                        checked={!callConnected}
                        onChange={() => setCallConnected(false)}
                        className="w-4 h-4 text-teal-600 border-slate-300 focus:ring-teal-500"
                      />
                      Not Connected
                    </label>
                  </div>
                </fieldset>

                <StatusField label="Select Reason">
                  <select
                    className="status-input"
                    value={callReason}
                    onChange={(e) => setCallReason(e.target.value)}
                    required
                  >
                    <option value="">Select Reason</option>
                    {CALL_REASONS.map((reason) => (
                      <option key={reason} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>
                </StatusField>

                <StatusField label="Follow Up Date" required>
                  <input
                    type="date"
                    className="status-input"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    required
                  />
                </StatusField>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <StatusField label="Status">
                    <select
                      className="status-input"
                      value={pipelineStatus}
                      onChange={(e) => setPipelineStatus(e.target.value)}
                    >
                      {PIPELINE_STATUS_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </StatusField>
                  <StatusField label="Source">
                    <select
                      className="status-input"
                      value={sourceDraft}
                      onChange={(e) => setSourceDraft(e.target.value)}
                    >
                      {SOURCE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </StatusField>
                </div>

                <StatusField label="Sales Person">
                  <select
                    className="status-input"
                    value={salesPerson}
                    onChange={(e) => setSalesPerson(e.target.value)}
                  >
                    {[...new Set([...SALES_PERSON_OPTIONS, salesPerson])].map((person) => (
                      <option key={person} value={person}>
                        {person}
                      </option>
                    ))}
                  </select>
                </StatusField>

                <StatusField label="Remark">
                  <textarea
                    className="status-input min-h-[72px] resize-y"
                    value={remarkDraft}
                    onChange={(e) => setRemarkDraft(e.target.value)}
                    rows={3}
                  />
                </StatusField>

                <StatusField label="Reference">
                  <textarea
                    className="status-input min-h-[72px] resize-y"
                    value={referenceDraft}
                    onChange={(e) => setReferenceDraft(e.target.value)}
                    placeholder="Doctor or any reference details"
                    rows={3}
                  />
                </StatusField>

                <button
                  type="submit"
                  className="w-full py-3 rounded-lg bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold border-none cursor-pointer transition-colors shadow-sm"
                >
                  Save
                </button>
              </form>
            )}

            {activeTab === "logs" && (
              <ul className="list-none m-0 p-0 stack gap-3">
                {logs.length === 0 ? (
                  <li className="text-sm text-slate-400">No activity logged yet.</li>
                ) : (
                  logs.map((log) => (
                    <li
                      key={log.id}
                      className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 text-sm"
                    >
                      <div className="flex justify-between gap-2">
                        <strong className="text-slate-800">{log.action}</strong>
                        <time className="text-[10px] text-slate-400 shrink-0">
                          {new Date(log.at).toLocaleString("en-IN", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </time>
                      </div>
                      <p className="m-0 mt-1 text-slate-600 text-xs">{log.detail}</p>
                      {log.by ? (
                        <p className="m-0 mt-1 text-[10px] text-slate-400">By {log.by}</p>
                      ) : null}
                    </li>
                  ))
                )}
              </ul>
            )}

            {activeTab === "qr" && (
              <div className="stack gap-5 items-center text-center">
                {hasQr ? (
                  <>
                    <div className="p-4 bg-white border-2 border-slate-100 rounded-2xl shadow-inner inline-flex">
                      <QRCodeCanvas
                        id={QR_CANVAS_ID}
                        value={qrCanvasValue}
                        size={220}
                        level="M"
                        includeMargin
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 m-0 max-w-md">
                      Scan opens a web page with full patient &amp; clinic details.
                    </p>
                    <a
                      href={qrPageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 font-semibold break-all hover:underline"
                    >
                      {qrPageUrl}
                    </a>

                    <div className="w-full max-w-lg text-left p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 stack gap-3">
                      <p className="m-0 font-bold text-slate-800 text-sm">Encoded patient details</p>
                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 m-0">
                        <QrDetail label="Patient" value={patient.patientName} />
                        <QrDetail label="Mobile" value={patient.mobileNumber} />
                        <QrDetail label="Patient ID" value={patient.id} />
                        <QrDetail label="QR Token" value={patient.qrToken ?? "—"} mono />
                        <QrDetail label="City" value={patient.city ?? "—"} />
                        <QrDetail label="Clinic" value={qrData?.assignedBranch ?? patient.assignedBranch ?? "—"} />
                        <QrDetail
                          label="Status"
                          value={String(qrData?.status ?? patient.status ?? "—").replace(/_/g, " ")}
                        />
                        <QrDetail
                          label="Appointment"
                          value={
                            qrData?.appointmentDate
                              ? `${qrData.appointmentDate}${qrData.appointmentSlot ? ` · ${qrData.appointmentSlot}` : ""}`
                              : patient.nextFollowUpDate
                                ? `${patient.nextFollowUpDate}${patient.nextFollowUpTime ? ` · ${patient.nextFollowUpTime}` : ""}`
                                : "—"
                          }
                        />
                        <QrDetail label="Source" value={patient.source ?? qrData?.source ?? "—"} />
                        <QrDetail label="Priority" value={patient.priority ?? qrData?.priority ?? "—"} />
                        {patient.notes?.trim() ? (
                          <div className="sm:col-span-2">
                            <QrDetail label="Notes" value={patient.notes} />
                          </div>
                        ) : null}
                        <QrDetail label="Clinic phone" value={qrData?.branchPhone ?? branch.phone} />
                        <div className="sm:col-span-2">
                          <QrDetail label="Clinic address" value={qrData?.branchAddress ?? branch.address} />
                        </div>
                        {qrData?.googleLocation ? (
                          <div className="sm:col-span-2">
                            <a
                              href={qrData.googleLocation}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 font-semibold hover:underline text-[11px]"
                            >
                              Open clinic on Google Maps
                            </a>
                          </div>
                        ) : null}
                      </dl>
                    </div>

                    <div className="w-full max-w-sm text-left p-4 rounded-xl bg-emerald-50/40 border border-emerald-100 text-xs text-slate-600 stack gap-2">
                      <p className="m-0 font-semibold text-emerald-800">WhatsApp message preview</p>
                      <pre className="m-0 whitespace-pre-wrap font-sans text-[11px] leading-relaxed">
                        {buildPatientWhatsAppMessage(patient)}
                      </pre>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center">
                      <ActionChip icon={Copy} label="Copy QR" onClick={copyCanvas} />
                      <ActionChip icon={Download} label="Download" onClick={downloadCanvas} />
                      <ActionChip
                        icon={Share2}
                        label="Send WhatsApp"
                        onClick={resendWhatsApp}
                        accent
                      />
                    </div>
                  </>
                ) : (
                  <div className="py-8 stack gap-4 items-center">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                      <QrCode size={32} />
                    </div>
                    <p className="text-sm text-slate-500 m-0 max-w-xs">
                      Generate a patient QR with clinic details. It will open WhatsApp on this
                      patient&apos;s number with a formatted message and QR image.
                    </p>
                    <button type="button" className="button primary" onClick={generateQrAndSend}>
                      Generate QR &amp; Send WhatsApp
                    </button>
                  </div>
                )}
                {hasQr ? (
                  <button
                    type="button"
                    className="button ghost text-xs"
                    onClick={generateQrAndSend}
                  >
                    Regenerate &amp; resend
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </motion.div>
      </div>
      ) : null}
    </AnimatePresence>
  );
}

function StatusField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-sm font-medium text-slate-700">
        {label}
        {required ? <span className="text-rose-500">*</span> : null}
      </span>
      {children}
    </label>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-bold text-slate-400 uppercase tracking-wider m-0">{label}</dt>
      <dd className="mt-0.5 m-0 font-semibold text-slate-800">{value}</dd>
    </div>
  );
}

function QrDetail({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[10px] font-bold text-slate-400 uppercase tracking-wider m-0">{label}</dt>
      <dd className={`mt-0.5 m-0 font-semibold text-slate-800 ${mono ? "font-mono text-[11px]" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

function ActionChip({
  icon: Icon,
  label,
  onClick,
  accent,
}: {
  icon: typeof Copy;
  label: string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border-none cursor-pointer transition-colors ${
        accent
          ? "bg-emerald-600 text-white hover:bg-emerald-700"
          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
      }`}
    >
      <Icon size={12} />
      {label}
    </button>
  );
}
