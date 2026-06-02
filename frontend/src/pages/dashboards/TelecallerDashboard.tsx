import { useMemo, useState, useEffect, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader } from "../../components/erp/PageHeader";
import { SectionCard } from "../../components/erp/SectionCard";
import { DataTable } from "../../components/erp/DataTable";
import { PatientNameButton } from "../../components/patient/PatientNameButton";
import { createQrToken, persistPatientQr } from "../../utils/patientQr";
import { normalizePatientProfile } from "../../types/patient";
import { useToast } from "../../layout/ToastProvider";
import { useAuth } from "../../auth/AuthContext";
import { api } from "../../services/api";
import {
  createAppointment,
  getAvailableSlots,
  type AppointmentSlot,
} from "../../data/appointmentStore";
import {
  User,
  Calendar,
  CheckCircle,
  Clock,
} from "lucide-react";

// Clinic locations
const CLINIC_OPTIONS = ["Delhi Gate", "Noida", "Laxmi Nagar", "Ghaziabad"];

export type LeadStatus =
  | "new_lead"
  | "not_answered"
  | "callback_requested"
  | "interested"
  | "appointment_booked"
  | "visited"
  | "trial_started"
  | "converted"
  | "lost"
  | "spam";

export interface IntelligentLead {
  id: string;
  patientName: string;
  mobileNumber: string;
  city: string;
  source: string;
  lastCallTime: string;
  status: LeadStatus;
  appointmentStatus: "none" | "booked" | "arrived" | "completed" | "no_show";
  assignedBranch: string;
  assignedAudiologist?: string;
  nextFollowUpDate?: string;
  nextFollowUpTime?: string;
  conversionProbability: number;
  priority: "high" | "medium" | "low";
  notes: string;
  bestTimeToCall: string;
  totalCallsLogged: number;
  callDurationSec: number;
  createdAt: string;
  qrPayload?: string | null;
  qrToken?: string | null;
}

const INITIAL_INTELLIGENT_LEADS: IntelligentLead[] = [
  {
    id: "LD-2001",
    patientName: "Rajesh Malhotra",
    mobileNumber: "9810123456",
    city: "Delhi Gate",
    source: "Google Ads",
    lastCallTime: "Today, 10:15 AM",
    status: "callback_requested",
    appointmentStatus: "none",
    assignedBranch: "Delhi Gate",
    nextFollowUpDate: new Date().toISOString().slice(0, 10), // Today
    nextFollowUpTime: "04:30 PM",
    conversionProbability: 75,
    priority: "high",
    notes: "Patient wants a rechargeable hearing aid trial. Left message to call back after 4 PM.",
    bestTimeToCall: "04:00 PM - 06:00 PM",
    totalCallsLogged: 2,
    callDurationSec: 180,
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: "LD-2002",
    patientName: "Kiran Mazumdar",
    mobileNumber: "9818811223",
    city: "Noida",
    source: "Facebook Campaign",
    lastCallTime: "Yesterday, 03:30 PM",
    status: "new_lead",
    appointmentStatus: "none",
    assignedBranch: "Noida",
    conversionProbability: 40,
    priority: "medium",
    notes: "New query regarding senior citizen discount on bilateral trials.",
    bestTimeToCall: "11:00 AM - 01:00 PM",
    totalCallsLogged: 1,
    callDurationSec: 45,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "LD-2003",
    patientName: "Gopal Subramanium",
    mobileNumber: "9910044556",
    city: "Ghaziabad",
    source: "Website Form",
    lastCallTime: "2 days ago",
    status: "interested",
    appointmentStatus: "none",
    assignedBranch: "Ghaziabad",
    nextFollowUpDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10), // Tomorrow
    nextFollowUpTime: "11:00 AM",
    conversionProbability: 80,
    priority: "high",
    notes: "Extremely interested. Needs doctor prescription verified. Requested trial slot soon.",
    bestTimeToCall: "10:00 AM - 12:00 PM",
    totalCallsLogged: 3,
    callDurationSec: 320,
    createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
  },
  {
    id: "LD-2004",
    patientName: "Vikram Rathore",
    mobileNumber: "8800223344",
    city: "Delhi Gate",
    source: "Doctor Referral",
    lastCallTime: "Today, 11:45 AM",
    status: "appointment_booked",
    appointmentStatus: "booked",
    assignedBranch: "Delhi Gate",
    assignedAudiologist: "Dr. Mehta",
    nextFollowUpDate: new Date().toISOString().slice(0, 10),
    nextFollowUpTime: "02:00 PM",
    conversionProbability: 95,
    priority: "high",
    notes: "Appointment booked automatically via CRM link. Audiologist assigned: Dr. Mehta.",
    bestTimeToCall: "02:00 PM - 04:00 PM",
    totalCallsLogged: 1,
    callDurationSec: 150,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    qrToken: "QR-2026-0004",
    qrPayload: JSON.stringify({ qrToken: "QR-2026-0004", patientName: "Vikram Rathore", mobileNumber: "8800223344" }),
  },
  {
    id: "LD-2005",
    patientName: "Dr. Sunita Kapoor",
    mobileNumber: "9871122334",
    city: "Laxmi Nagar",
    source: "Instagram Lead",
    lastCallTime: "3 days ago",
    status: "not_answered",
    appointmentStatus: "none",
    assignedBranch: "Laxmi Nagar",
    conversionProbability: 25,
    priority: "low",
    notes: "Called thrice, went to voicemail. Active inactive alert triggered.",
    bestTimeToCall: "06:00 PM - 08:00 PM",
    totalCallsLogged: 4,
    callDurationSec: 0,
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
];

export function TelecallerDashboard() {
  const { session } = useAuth();
  const { pushToast } = useToast();

  // Primary states
  const [leads, setLeads] = useState<IntelligentLead[]>(() => {
    const saved = localStorage.getItem("softone.telecaller.intelligent_leads");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return INITIAL_INTELLIGENT_LEADS;
      }
    }
    return INITIAL_INTELLIGENT_LEADS;
  });

  // Search & Filter state
  const searchQuery = "";
  const branchFilter = "all";

  // Selected patient for right-side drawer
  const [selectedLead, setSelectedLead] = useState<IntelligentLead | null>(null);

  // Drawer form states
  const [callConnected, setCallConnected] = useState(false);
  const [interested, setInterested] = useState(false);
  const [drawerStatus, setDrawerStatus] = useState<"in_progress" | "finalized" | "spam">("in_progress");
  const [drawerComment, setDrawerComment] = useState("");
  const [bookAppointment, setBookAppointment] = useState(false);
  const [apptBranch, setApptBranch] = useState(CLINIC_OPTIONS[0]);
  const [apptDate, setApptDate] = useState("");
  const [apptSlot, setApptSlot] = useState<AppointmentSlot>("10:00 AM");

  // Keep state updated in localStorage
  useEffect(() => {
    localStorage.setItem("softone.telecaller.intelligent_leads", JSON.stringify(leads));
  }, [leads]);

  // Load leads from database if online
  useEffect(() => {
    async function loadDbLeads() {
      try {
        const dbEntries = await api.telecaller.listEntries();
        if (dbEntries.length > 0) {
          const mappedLeads: IntelligentLead[] = dbEntries.map((entry) => ({
            id: entry.id,
            patientName: entry.patientName,
            mobileNumber: entry.mobileNumber,
            city: entry.city,
            source: "Manual Outbound",
            lastCallTime: "Just now",
            status: entry.appointmentBooked 
              ? "appointment_booked" 
              : (entry.followUpRequired ? "callback_requested" : (entry.responseType === "positive" ? "interested" : "not_answered")),
            appointmentStatus: entry.appointmentBooked ? "booked" : "none",
            assignedBranch: entry.appointmentBooked ? entry.clinicName : entry.city,
            nextFollowUpDate: entry.appointmentBooked ? entry.appointmentDate : (entry.followUpRequired ? entry.followUpDate : undefined),
            nextFollowUpTime: entry.appointmentBooked ? entry.appointmentSlot : (entry.followUpRequired ? entry.followUpTime : undefined),
            conversionProbability: entry.appointmentBooked ? 95 : (entry.responseType === "positive" ? 70 : 20),
            priority: entry.responseType === "positive" ? "high" : "medium",
            notes: entry.callNotes,
            bestTimeToCall: "10:00 AM - 12:00 PM",
            totalCallsLogged: 1,
            callDurationSec: 60,
            createdAt: entry.createdAt,
            qrToken: entry.qrToken,
            qrPayload: entry.qrPayload
          }));
          setLeads(mappedLeads);
        }
      } catch (err) {
        console.log("[TelecallerDashboard] Backend offline, using local storage leads.");
      }
    }
    loadDbLeads();
  }, []);

  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return {
      total: leads.length,
      followups: leads.filter((e) => e.status === "callback_requested" || e.status === "not_answered" || e.nextFollowUpDate === todayStr).length,
      finalPatients: leads.filter((e) => e.status === "appointment_booked" || e.status === "converted" || e.appointmentStatus === "booked").length,
    };
  }, [leads]);

  const followUpLeads = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return leads.filter((lead) => {
      const isFollowUp = lead.status === "callback_requested" || lead.status === "not_answered" || lead.nextFollowUpDate === todayStr;
      
      const name = lead.patientName ?? "";
      const mobile = lead.mobileNumber ?? "";
      const city = lead.city ?? "";
      const matchSearch =
        name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mobile.includes(searchQuery) ||
        city.toLowerCase().includes(searchQuery.toLowerCase());

      const matchBranch = branchFilter === "all" ? true : lead.assignedBranch === branchFilter;

      return isFollowUp && matchSearch && matchBranch;
    });
  }, [leads, searchQuery, branchFilter]);

  const availableSlots = useMemo(() => {
    const dateToCheck = apptDate || new Date().toISOString().slice(0, 10);
    return getAvailableSlots(apptBranch, dateToCheck);
  }, [apptBranch, apptDate]);

  function handleSaveDrawer(e: FormEvent) {
    e.preventDefault();
    if (!selectedLead) return;

    if (bookAppointment) {
      if (!apptDate) {
        pushToast("Please choose an appointment date", "error");
        return;
      }
      if (!availableSlots.includes(apptSlot) && !selectedLead.qrToken) {
        pushToast("This slot is already packed. Please choose another.", "error");
        return;
      }
    }

    let resolvedStatus: LeadStatus = "callback_requested";
    if (drawerStatus === "spam") {
      resolvedStatus = "spam";
    } else if (bookAppointment) {
      resolvedStatus = "appointment_booked";
    } else if (interested) {
      resolvedStatus = "interested";
    } else if (!callConnected) {
      resolvedStatus = "not_answered";
    }

    let qrToken = selectedLead.qrToken || null;
    let qrPayload = selectedLead.qrPayload || null;

    if (bookAppointment && !qrToken) {
      qrToken = createQrToken(leads.length);
      const persisted = persistPatientQr(
        normalizePatientProfile({
          id: selectedLead.id,
          patientName: selectedLead.patientName,
          mobileNumber: selectedLead.mobileNumber,
          city: selectedLead.city,
          source: selectedLead.source,
          status: resolvedStatus,
          appointmentStatus: "booked",
          assignedBranch: apptBranch,
          nextFollowUpDate: apptDate,
          nextFollowUpTime: apptSlot,
          notes: drawerComment.trim() || selectedLead.notes,
          priority: selectedLead.priority,
        }),
        qrToken
      );
      qrPayload = persisted.payload;

      const apptResult = createAppointment({
        patientName: selectedLead.patientName,
        mobileNumber: selectedLead.mobileNumber,
        clinicName: apptBranch,
        date: apptDate,
        slot: apptSlot,
        source: "telecaller",
        status: "booked",
        bookedBy: session?.fullName ?? "Telecaller",
      });

      if (apptResult.ok === false) {
        pushToast(apptResult.reason, "error");
        return;
      }
    } else if (!bookAppointment) {
      qrToken = null;
      qrPayload = null;
    }

    const updatedLeads = leads.map((lead) => {
      if (lead.id === selectedLead.id) {
        return {
          ...lead,
          status: resolvedStatus,
          appointmentStatus: bookAppointment ? ("booked" as const) : ("none" as const),
          assignedBranch: bookAppointment ? apptBranch : lead.assignedBranch,
          nextFollowUpDate: bookAppointment ? apptDate : undefined,
          nextFollowUpTime: bookAppointment ? apptSlot : undefined,
          notes: drawerComment.trim(),
          qrToken,
          qrPayload,
          totalCallsLogged: callConnected ? Math.max(1, lead.totalCallsLogged) : lead.totalCallsLogged,
        };
      }
      return lead;
    });

    setLeads(updatedLeads);
    pushToast("Patient follow-up session updated successfully!", "success");
    setSelectedLead(null);
  }

  function getStatusBadge(status: LeadStatus) {
    const labels: Record<LeadStatus, string> = {
      new_lead: "New Lead",
      not_answered: "No Answer",
      callback_requested: "Callback Scheduled",
      interested: "Interested",
      appointment_booked: "Appt Booked",
      visited: "Visited Clinic",
      trial_started: "Trial Active",
      converted: "Converted 🎉",
      lost: "Lost Lead",
      spam: "Flagged Spam 🚨",
    };

    const classes: Record<LeadStatus, string> = {
      new_lead: "bg-blue-50 text-blue-700 border-blue-100",
      not_answered: "bg-slate-100 text-slate-700 border-slate-200",
      callback_requested: "bg-amber-50 text-amber-700 border-amber-200",
      interested: "bg-indigo-50 text-indigo-700 border-indigo-200",
      appointment_booked: "bg-purple-50 text-purple-700 border-purple-200",
      visited: "bg-cyan-50 text-cyan-700 border-cyan-200",
      trial_started: "bg-orange-50 text-orange-700 border-orange-200",
      converted: "bg-emerald-50 text-emerald-700 border-emerald-200",
      lost: "bg-rose-50 text-rose-700 border-rose-200",
      spam: "bg-red-50 text-red-700 border-red-200",
    };

    const label = labels[status] ?? status;
    const className = classes[status] ?? "bg-slate-100 text-slate-700 border-slate-200";

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${className}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${
          ["converted", "trial_started"].includes(status) ? "bg-emerald-500" :
          ["new_lead", "interested"].includes(status) ? "bg-blue-500" :
          ["callback_requested"].includes(status) ? "bg-amber-500" : "bg-rose-500"
        }`}></span>
        {label}
      </span>
    );
  }

  // Sync drawer fields when a lead is selected
  useEffect(() => {
    if (selectedLead) {
      setCallConnected(selectedLead.totalCallsLogged > 0);
      setInterested(selectedLead.status === "interested" || selectedLead.status === "appointment_booked");
      
      let initialStatus: "in_progress" | "finalized" | "spam" = "in_progress";
      if (selectedLead.status === "converted" || selectedLead.status === "visited" || selectedLead.status === "appointment_booked") {
        initialStatus = "finalized";
      } else if (selectedLead.status === "spam") {
        initialStatus = "spam";
      }
      setDrawerStatus(initialStatus);
      setDrawerComment(selectedLead.notes || "");
      setBookAppointment(selectedLead.appointmentStatus === "booked");
      setApptBranch(selectedLead.assignedBranch || CLINIC_OPTIONS[0]);
      setApptDate(selectedLead.nextFollowUpDate || "");
      setApptSlot((selectedLead.nextFollowUpTime as AppointmentSlot) || "10:00 AM");
    }
  }, [selectedLead]);

  return (
    <section className="stack animate-fade-in">
      <PageHeader
        title="Telecaller CRM Dashboard"
        subtitle={`Welcome back, ${session?.fullName}. View daily callbacks, follow-ups, and log patient interactions.`}
      />

      {/* Modern Summary Stats bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4 bg-white border border-slate-100 rounded-2xl flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <User size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Assigned Leads</p>
            <p className="text-xl font-bold text-slate-800">{stats.total}</p>
          </div>
        </div>
        <div className="card p-4 bg-white border border-slate-100 rounded-2xl flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Calendar size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Daily Follow-ups</p>
            <p className="text-xl font-bold text-slate-800">{stats.followups}</p>
          </div>
        </div>
        <div className="card p-4 bg-white border border-slate-100 rounded-2xl flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Confirmed Patients</p>
            <p className="text-xl font-bold text-slate-800">{stats.finalPatients}</p>
          </div>
        </div>
      </div>

      {/* Main CRM Work Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Side: Intelligent Follow-ups Feed */}
        <div className="lg:col-span-2">
          <SectionCard title="Today's Scheduled Follow-up Patients" subtitle="Outbound queue of patients requiring follow-up callbacks.">
            <DataTable
              headers={["Patient", "Mobile", "City", "Status"]}
              hasRows={followUpLeads.length > 0}
              empty="No pending follow-ups for today. Great job!"
            >
              {followUpLeads.map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <div className="stack compact">
                      <PatientNameButton patient={lead} />
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{lead.id}</span>
                    </div>
                  </td>
                  <td className="font-medium text-slate-600">{lead.mobileNumber}</td>
                  <td className="text-slate-600 font-semibold">{lead.city}</td>
                  <td>{getStatusBadge(lead.status)}</td>
                  <td>
                    {/* <button
                      onClick={() => setSelectedLead(lead)}
                      className="py-1 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-black rounded-lg transition-all border-none cursor-pointer flex items-center gap-1"
                      type="button"
                    >
                      view updates <ArrowRight size={12} />
                    </button> */}
                  </td>
                </tr>
              ))}
            </DataTable>
          </SectionCard>
        </div>

        {/* Right Side: Interactive Call Logging Drawer */}
        <div>
          <AnimatePresence mode="wait">
            {selectedLead ? (
              <motion.div
                key="drawer-active"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
              >
                <SectionCard
                  title={`Call Log: ${selectedLead.patientName}`}
                  subtitle="Update patient response, schedule callbacks, or book clinic slots."
                >
                  <form onSubmit={handleSaveDrawer} className="stack gap-4">
                    {/* Call Notes */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Call Discussion Notes</span>
                      <textarea
                        value={drawerComment}
                        onChange={(e) => setDrawerComment(e.target.value)}
                        placeholder="Type detailed call feedback here..."
                        className="input min-h-[80px] text-xs py-2"
                        required
                      />
                    </div>

                    {/* Call Outcome Controls */}
                    <div className="grid grid-cols-2 gap-3">
                      <label className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl cursor-pointer border border-slate-100">
                        <input
                          type="checkbox"
                          checked={callConnected}
                          onChange={(e) => setCallConnected(e.target.checked)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-xs font-bold text-slate-700">Call Connected</span>
                      </label>

                      <label className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl cursor-pointer border border-slate-100">
                        <input
                          type="checkbox"
                          checked={interested}
                          onChange={(e) => setInterested(e.target.checked)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-xs font-bold text-slate-700">Positive Response</span>
                      </label>
                    </div>

                    {/* Lead Lifecycle Status */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lead Lifecycle Stage</span>
                      <select
                        value={drawerStatus}
                        onChange={(e) => setDrawerStatus(e.target.value as any)}
                        className="input text-xs"
                      >
                        <option value="in_progress">Callback Required (Still Active)</option>
                        <option value="finalized">Finalized (Appointment / Converted)</option>
                        <option value="spam">Flag Spam / Invalid Number</option>
                      </select>
                    </div>

                    {/* Book Appointment Toggle */}
                    <div className="border-t border-slate-100 pt-4">
                      <label className="flex items-center gap-2.5 p-3 bg-blue-50/50 hover:bg-blue-50 rounded-xl cursor-pointer border border-blue-100/50 transition-colors">
                        <input
                          type="checkbox"
                          checked={bookAppointment}
                          onChange={(e) => setBookAppointment(e.target.checked)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-xs font-black text-blue-900">Book Physical Clinic Appointment</span>
                      </label>
                    </div>

                    {/* Appointment Sub-Form */}
                    {bookAppointment && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="stack gap-3.5 bg-slate-50/50 p-3.5 rounded-xl border border-slate-150 mt-1"
                      >
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select Clinic Branch</span>
                          <select
                            value={apptBranch}
                            onChange={(e) => setApptBranch(e.target.value)}
                            className="input text-xs bg-white"
                          >
                            {CLINIC_OPTIONS.map((c) => (
                              <option key={c} value={c}>{c} Clinic</option>
                            ))}
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</span>
                            <input
                              type="date"
                              value={apptDate}
                              onChange={(e) => setApptDate(e.target.value)}
                              className="input text-xs bg-white"
                              required={bookAppointment}
                            />
                          </div>

                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Time Slot</span>
                            <select
                              value={apptSlot}
                              onChange={(e) => setApptSlot(e.target.value as AppointmentSlot)}
                              className="input text-xs bg-white"
                            >
                              {availableSlots.map((slot) => (
                                <option key={slot} value={slot}>{slot}</option>
                              ))}
                              {availableSlots.length === 0 && (
                                <option disabled>No slots available</option>
                              )}
                            </select>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2.5 border-t border-slate-100 pt-4 mt-2">
                      <button
                        type="submit"
                        className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl transition-all border-none cursor-pointer text-center"
                      >
                        Save Call Log
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedLead(null)}
                        className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-all border-none cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </SectionCard>
              </motion.div>
            ) : (
              <motion.div
                key="drawer-empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-8 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center stack gap-2.5"
              >
                <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                  <Clock size={20} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-700">No Active Call Session</h4>
                  <p className="text-[10px] text-slate-400 font-semibold mt-1">Select a patient from the follow-up feed to log call notes and outcomes.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
