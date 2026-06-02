import { type FormEvent, useMemo, useState, useEffect } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { motion, AnimatePresence } from "framer-motion";
import {
  createAppointment,
  getAvailableSlots,
  type AppointmentSlot,
} from "../../data/appointmentStore";
import { findEntryByMobileNumber } from "../../data/telecallerStore";
import { useAuth } from "../../auth/AuthContext";
import { api } from "../../services/api";
import { SectionCard } from "../../components/erp/SectionCard";
import { DataTable } from "../../components/erp/DataTable";
import { useToast } from "../../layout/ToastProvider";
import { PatientNameButton } from "../../components/patient/PatientNameButton";
import { getPatientQrCodeUrl, persistPatientQr } from "../../utils/patientQr";
import { normalizePatientProfile } from "../../types/patient";
import {
  User,
  CheckCircle,
  XCircle,
  QrCode,
  Download,
  Share2,
  Search,
  Phone,
  MapPin,
  Building,
  Calendar,
  Clock,
  Check,
  Copy,
  X,
} from "lucide-react";

// Clinic locations and Doctors
const CLINIC_OPTIONS = ["Delhi Gate", "Noida", "Laxmi Nagar", "Ghaziabad"];
const AUDIOLOGIST_OPTIONS = ["Dr. Mehta", "Dr. Sharma", "Dr. Roy", "Dr. Gupta"];

const BRANCHES_MAP: Record<string, { phone: string; address: string; locationLink: string }> = {
  "delhi gate": {
    phone: "+91 98101 23456",
    address: "12, Netaji Subhash Marg, Daryaganj, near Delhi Gate Metro Station, New Delhi, 110002",
    locationLink: "https://maps.google.com/?q=Delhi+Gate+Metro+Station",
  },
  "noida": {
    phone: "+91 98188 11223",
    address: "C-56, Sector 62, Landmark: Near Fortis Hospital, Noida, Uttar Pradesh, 201301",
    locationLink: "https://maps.google.com/?q=Sector+62+Noida",
  },
  "laxmi nagar": {
    phone: "+91 99100 44556",
    address: "A-24, Main Vikas Marg, near Laxmi Nagar Metro Station Gate No. 1, East Delhi, 110092",
    locationLink: "https://maps.google.com/?q=Laxmi+Nagar+East+Delhi",
  },
  "ghaziabad": {
    phone: "+91 88002 23344",
    address: "SF-14, Second Floor, Opulent Mall, Gandhi Nagar, Grand Trunk Road, Ghaziabad, Uttar Pradesh, 201001",
    locationLink: "https://maps.google.com/?q=Opulent+Mall+Ghaziabad",
  },
};

function getBranchDetails(clinicName: string) {
  const norm = clinicName.toLowerCase().replace(/\s*clinic/i, "").trim();
  return (
    BRANCHES_MAP[norm] || {
      phone: "+91 98101 23456",
      address: "12, Netaji Subhash Marg, Daryaganj, near Delhi Gate Metro Station, New Delhi, 110002",
      locationLink: "https://maps.google.com/?q=Delhi+Gate+Metro+Station",
    }
  );
}

// Lead Status Flow Definition
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
  conversionProbability: number; // 0 to 100%
  priority: "high" | "medium" | "low";
  notes: string;
  bestTimeToCall: string;
  totalCallsLogged: number;
  callDurationSec: number;
  createdAt: string;
  qrPayload?: string | null;
  qrToken?: string | null;
}

// Initial Mock Leads for high interactivity
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
    qrToken: "ST-004",
    qrPayload: JSON.stringify({ qrToken: "ST-004", patientName: "Vikram Rathore", mobileNumber: "8800223344" }),
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
  {
    id: "LD-2006",
    patientName: "Ananya Deshmukh",
    mobileNumber: "9560456123",
    city: "Noida",
    source: "Walk-in Referral",
    lastCallTime: "Yesterday, 05:12 PM",
    status: "trial_started",
    appointmentStatus: "completed",
    assignedBranch: "Noida",
    conversionProbability: 90,
    priority: "high",
    notes: "Consultation completed. Trial hearing aid issued. Checking back on feedback in 3 days.",
    bestTimeToCall: "10:00 AM - 12:00 PM",
    totalCallsLogged: 2,
    callDurationSec: 290,
    createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
  },
  {
    id: "LD-2007",
    patientName: "Sanjay Singhal",
    mobileNumber: "9810098765",
    city: "Ghaziabad",
    source: "Google Ads",
    lastCallTime: "Today, 09:30 AM",
    status: "spam",
    appointmentStatus: "none",
    assignedBranch: "Ghaziabad",
    conversionProbability: 0,
    priority: "low",
    notes: "Telemarketing company / spam caller. Number flagged.",
    bestTimeToCall: "Unknown",
    totalCallsLogged: 1,
    callDurationSec: 15,
    createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
];

function createQrToken(entryCount: number): string {
  return `ST-${String(entryCount + 1).padStart(3, "0")}`;
}

export function CrmLeadsPage() {
  const { session } = useAuth();
  const { pushToast } = useToast();

  function copyCanvasToClipboard(canvasId: string) {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) {
      pushToast("QR Code element not found", "error");
      return;
    }
    try {
      canvas.toBlob((blob) => {
        if (!blob) {
          pushToast("Failed to process QR Code image", "error");
          return;
        }
        navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob })
        ]).then(() => {
          pushToast("QR Code image copied to clipboard! Paste (Ctrl+V) it in WhatsApp or anywhere.", "success");
        }).catch((err) => {
          console.error(err);
          pushToast("Could not copy image to clipboard. Try downloading instead.", "error");
        });
      }, "image/png");
    } catch (e) {
      console.error(e);
      pushToast("Copy failed. Try downloading it instead.", "error");
    }
  }

  function downloadCanvasImage(canvasId: string, filename: string) {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) {
      pushToast("QR Code element not found", "error");
      return;
    }
    try {
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      pushToast("QR Code image downloaded successfully!", "success");
    } catch (e) {
      console.error(e);
      pushToast("Failed to download image", "error");
    }
  }

  function shareToWhatsApp(entry: any, canvasId: string) {
    const bDetails = getBranchDetails(entry.assignedBranch);
    const detailsText = `📝 *Softone ERP - Appointment Confirmed!*
🎫 *Token Number:* ${entry.qrToken || "N/A"}
👤 *Patient:* ${entry.patientName}
📞 *Contact:* ${entry.mobileNumber}
🏢 *Clinic:* ${entry.assignedBranch}
📅 *Date:* ${entry.nextFollowUpDate}
⏰ *Slot:* ${entry.nextFollowUpTime}

🏢 *Clinic Address:* ${bDetails.address}
📞 *Clinic Phone:* ${bDetails.phone}
🗺 *Google Location:* ${bDetails.locationLink}`;

    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (canvas) {
      try {
        canvas.toBlob((blob) => {
          if (blob) {
            const textUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(detailsText)}`;
            const file = new File([blob], "appointment-qr.png", { type: "image/png" });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              navigator.share({
                title: 'Softone Appointment QR',
                text: detailsText,
                files: [file]
              }).then(() => {
                pushToast("Appointment and QR Code shared successfully via WhatsApp!", "success");
              }).catch(() => {
                navigator.clipboard.write([
                  new ClipboardItem({ "image/png": blob })
                ]).then(() => {
                  window.open(textUrl, "_blank");
                  pushToast("QR Image copied automatically! Just press Paste (Ctrl+V) in WhatsApp.", "success");
                });
              });
            } else {
              navigator.clipboard.write([
                new ClipboardItem({ "image/png": blob })
              ]).then(() => {
                window.open(textUrl, "_blank");
                pushToast("QR Image copied automatically! Just press Paste (Ctrl+V) in WhatsApp.", "success");
              });
            }
          } else {
            const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(detailsText)}`;
            window.open(url, "_blank");
            pushToast("Opening WhatsApp...", "success");
          }
        }, "image/png");
        return;
      } catch (e) {
        console.error(e);
      }
    }
    
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(detailsText)}`;
    window.open(url, "_blank");
    pushToast("Opening WhatsApp...", "success");
  }

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
        console.log("[CrmLeadsPage] Backend offline, using local storage leads.");
      }
    }
    loadDbLeads();
  }, []);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  // New Lead Form states
  const [patientName, setPatientName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [city, setCity] = useState("");
  const [responseType, setResponseType] = useState<"interested" | "not_interested">("interested");
  const [comment, setComment] = useState("");

  const [generateQr, setGenerateQr] = useState(false);
  const [clinicName, setClinicName] = useState(CLINIC_OPTIONS[0]);
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentSlot, setAppointmentSlot] = useState<AppointmentSlot>("10:00 AM");

  const [scheduleFollowUp, setScheduleFollowUp] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpTime, setFollowUpTime] = useState("10:00 AM");

  const [lastSavedEntry, setLastSavedEntry] = useState<IntelligentLead | null>(null);
  const [qrModalEntry, setQrModalEntry] = useState<IntelligentLead | null>(null);

  // Keep state updated in localStorage
  useEffect(() => {
    localStorage.setItem("softone.telecaller.intelligent_leads", JSON.stringify(leads));
  }, [leads]);

  const stats = useMemo(() => {
    return {
      total: leads.length,
      positive: leads.filter((e) => e.status === "interested" || e.status === "appointment_booked" || e.status === "converted").length,
      appointments: leads.filter((e) => e.appointmentStatus === "booked").length,
    };
  }, [leads]);

  function resetForm() {
    setPatientName("");
    setMobileNumber("");
    setCity("");
    setResponseType("interested");
    setComment("");
    setGenerateQr(false);
    setAppointmentDate("");
    setAppointmentSlot("10:00 AM");
    setScheduleFollowUp(false);
    setFollowUpDate("");
    setFollowUpTime("10:00 AM");
  }

  async function handleSaveLead(event: FormEvent) {
    event.preventDefault();

    // Validations
    if (!patientName.trim()) {
      pushToast("Patient name is required", "error");
      return;
    }
    if (!mobileNumber.trim()) {
      pushToast("Mobile number is required", "error");
      return;
    }
    if (!city.trim()) {
      pushToast("City is required", "error");
      return;
    }
    if (!comment.trim()) {
      pushToast("Comment is required", "error");
      return;
    }

    // Duplicate Check - Local
    const duplicate = findEntryByMobileNumber(mobileNumber);
    if (duplicate) {
      pushToast(`This mobile number was already added by ${duplicate.createdBy}`, "error");
      return;
    }

    // Duplicate Check - Database
    try {
      const dbDup = await api.telecaller.checkDuplicateMobile(mobileNumber);
      if (dbDup.found && dbDup.entry) {
        pushToast(`This mobile number was already added by ${dbDup.entry.createdBy} in the database`, "error");
        return;
      }
    } catch (err) {
      console.log("Database offline, skipping remote duplicate check.");
    }

    // Appointment validations
    if (generateQr) {
      if (!appointmentDate) {
        pushToast("Please select an appointment date", "error");
        return;
      }
      const availableSlots = getAvailableSlots(clinicName, appointmentDate);
      if (!availableSlots.includes(appointmentSlot)) {
        pushToast("This slot is already packed. Please choose another available slot.", "error");
        return;
      }
    }

    // Follow-up validations
    if (scheduleFollowUp) {
      if (!followUpDate) {
        pushToast("Please select a follow-up date", "error");
        return;
      }
      if (!followUpTime) {
        pushToast("Please select a follow-up time", "error");
        return;
      }
    }

    // Process saving
    const qrToken = generateQr ? createQrToken(leads.length) : null;

    const newLead: IntelligentLead = {
      id: `LD-${leads.length + 2001}`,
      patientName: patientName.trim(),
      mobileNumber: mobileNumber.trim(),
      city: city.trim(),
      source: "Manual Outbound",
      lastCallTime: "Just now",
      status: generateQr 
        ? "appointment_booked" 
        : (scheduleFollowUp ? "callback_requested" : (responseType === "interested" ? "interested" : "not_answered")),
      appointmentStatus: generateQr ? "booked" : "none",
      assignedBranch: generateQr ? clinicName.trim() : city.trim(),
      assignedAudiologist: generateQr ? AUDIOLOGIST_OPTIONS[0] : undefined,
      nextFollowUpDate: generateQr ? appointmentDate : (scheduleFollowUp ? followUpDate : undefined),
      nextFollowUpTime: generateQr ? appointmentSlot : (scheduleFollowUp ? followUpTime : undefined),
      conversionProbability: generateQr ? 95 : (responseType === "interested" ? 70 : 20),
      priority: responseType === "interested" ? "high" : "medium",
      notes: comment.trim(),
      bestTimeToCall: "10:00 AM - 12:00 PM",
      totalCallsLogged: 1,
      callDurationSec: 60,
      createdAt: new Date().toISOString(),
      qrToken,
      qrPayload: null,
    };

    if (generateQr && qrToken) {
      newLead.qrPayload = persistPatientQr(
        normalizePatientProfile({
          id: newLead.id,
          patientName: newLead.patientName,
          mobileNumber: newLead.mobileNumber,
          city: newLead.city,
          source: newLead.source,
          status: newLead.status,
          appointmentStatus: newLead.appointmentStatus,
          assignedBranch: newLead.assignedBranch,
          assignedAudiologist: newLead.assignedAudiologist,
          nextFollowUpDate: newLead.nextFollowUpDate,
          nextFollowUpTime: newLead.nextFollowUpTime,
          notes: newLead.notes,
          priority: newLead.priority,
        }),
        qrToken
      ).payload;
    }

    if (generateQr) {
      // Try database appointment booking first
      try {
        const apptRes = await api.appointments.create({
          patientName: newLead.patientName,
          mobileNumber: newLead.mobileNumber,
          clinicName: clinicName.trim(),
          date: appointmentDate,
          slot: appointmentSlot,
          source: "telecaller",
          status: "booked",
          bookedBy: session?.fullName ?? "Telecaller",
        });
        if (apptRes && !apptRes.ok) {
          pushToast(apptRes.reason || "Slot already booked in database.", "error");
          return;
        }
      } catch (err) {
        console.log("Database offline, booking appointment locally.");
        // Fallback to local storage booking
        const apptResult = createAppointment({
          patientName: newLead.patientName,
          mobileNumber: newLead.mobileNumber,
          clinicName: clinicName.trim(),
          date: appointmentDate,
          slot: appointmentSlot,
          source: "telecaller",
          status: "booked",
          bookedBy: session?.fullName ?? "Telecaller",
        });

        if (!apptResult.ok) {
          pushToast(apptResult.reason, "error");
          return;
        }
      }
    }

    // Save telecaller entry to database if online
    try {
      await api.telecaller.saveEntry({
        id: newLead.id,
        createdBy: session?.fullName ?? "Telecaller",
        city: newLead.city,
        patientName: newLead.patientName,
        mobileNumber: newLead.mobileNumber,
        whatsappNumber: newLead.mobileNumber,
        leadType: "new_enquiry" as any,
        responseType: (responseType === "interested" ? "positive" : "negative") as any,
        callConnected: true,
        callNotes: newLead.notes,
        callOutcome: (generateQr ? "appointment_fixed" : (scheduleFollowUp ? "follow_up_scheduled" : "not_interested")) as any,
        followUpRequired: scheduleFollowUp,
        followUpReason: scheduleFollowUp ? "Follow up callback" : "",
        followUpDate: scheduleFollowUp ? followUpDate : "",
        followUpTime: scheduleFollowUp ? followUpTime : "",
        appointmentBooked: generateQr,
        clinicName: generateQr ? clinicName : "",
        appointmentDate: generateQr ? appointmentDate : "",
        appointmentSlot: generateQr ? appointmentSlot : "",
        qrToken: newLead.qrToken || null,
        qrPayload: newLead.qrPayload || null,
        createdAt: newLead.createdAt
      });
    } catch (err) {
      console.log("Database offline, skipping remote lead save.");
    }

    setLeads((prev) => [newLead, ...prev]);
    setLastSavedEntry(newLead);
    pushToast("CRM Patient Lead updated successfully!", "success");
    if (generateQr) {
      setQrModalEntry(newLead);
    }
    resetForm();
  }

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const matchSearch =
        lead.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.mobileNumber.includes(searchQuery) ||
        lead.city.toLowerCase().includes(searchQuery.toLowerCase());

      const matchStatus = statusFilter === "all" ? true : lead.status === statusFilter;
      const matchBranch = branchFilter === "all" ? true : lead.assignedBranch === branchFilter;
      const matchPriority = priorityFilter === "all" ? true : lead.priority === priorityFilter;

      return matchSearch && matchStatus && matchBranch && matchPriority;
    });
  }, [leads, searchQuery, statusFilter, branchFilter, priorityFilter]);

  const availableSlots = useMemo(() => {
    const dateToCheck = appointmentDate || new Date().toISOString().slice(0, 10);
    return getAvailableSlots(clinicName, dateToCheck);
  }, [clinicName, appointmentDate]);

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

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${classes[status]}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${
          ["converted", "trial_started"].includes(status) ? "bg-emerald-500" :
          ["new_lead", "interested"].includes(status) ? "bg-blue-500" :
          ["callback_requested"].includes(status) ? "bg-amber-500" : "bg-rose-500"
        }`}></span>
        {labels[status]}
      </span>
    );
  }

  return (
    <section className="stack">
      {/* Dynamic smart header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-blue-900 flex items-center gap-2">
            <Building className="text-blue-600 shrink-0" size={24} />
            Patient Leads CRM Workspace
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-1">
            Register patient calling feedback, track clinic reservations, and generate confirmation check-in QR codes.
          </p>
        </div>
      </div>

      {/* Modern Summary Stats bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4 bg-white border border-slate-100 rounded-2xl flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <User size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Registered</p>
            <p className="text-xl font-bold text-slate-800">{stats.total}</p>
          </div>
        </div>
        <div className="card p-4 bg-white border border-slate-100 rounded-2xl flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Positive Response</p>
            <p className="text-xl font-bold text-slate-800">{stats.positive}</p>
          </div>
        </div>
        <div className="card p-4 bg-white border border-slate-100 rounded-2xl flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <QrCode size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">QR Generated Appointments</p>
            <p className="text-xl font-bold text-slate-800">{stats.appointments}</p>
          </div>
        </div>
      </div>

      <div className="w-full">
        {/* Main Minimalist Form */}
        <form className="card p-6 bg-white border border-slate-200 rounded-2xl shadow-sm stack gap-5" onSubmit={handleSaveLead}>
          <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-blue-600 rounded-full"></span>
            Add Patient Information
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600 flex items-center gap-1">
                <User size={12} className="text-blue-500" /> Patient Name
              </label>
              <input
                type="text"
                className="input py-2.5 px-3 border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-white focus:bg-white transition-all text-sm outline-none"
                placeholder="Enter full name"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600 flex items-center gap-1">
                <Phone size={12} className="text-blue-500" /> Mobile Number
              </label>
              <input
                type="tel"
                className="input py-2.5 px-3 border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-white focus:bg-white transition-all text-sm outline-none"
                placeholder="Enter 10-digit number"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600 flex items-center gap-1">
                <MapPin size={12} className="text-blue-500" /> City
              </label>
              <input
                type="text"
                className="input py-2.5 px-3 border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-white focus:bg-white transition-all text-sm outline-none"
                placeholder="E.g. Delhi, Noida"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>

            {/* Segmented control for response */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600">Call Response</label>
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setResponseType("interested")}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    responseType === "interested"
                      ? "bg-white text-emerald-600 shadow-sm border border-emerald-100"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <CheckCircle size={14} /> Interested
                </button>
                <button
                  type="button"
                  onClick={() => setResponseType("not_interested")}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    responseType === "not_interested"
                      ? "bg-white text-rose-600 shadow-sm border border-rose-100"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <XCircle size={14} /> Not Interested
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-600">Comment / Call Notes (Necessary)</label>
            <textarea
              className="input py-2 px-3 border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-white focus:bg-white transition-all text-sm outline-none min-h-[80px] resize-none"
              placeholder="Write a quick summary of the call outcome..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>

          {/* Seamless QR check / slide option */}
          <div className="border-t border-slate-100 pt-4 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-slate-800">Generate Appointment QR Code</span>
              <span className="text-xs text-slate-500 font-medium">Instantly book a clinic slot & generate a check-in QR</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={generateQr}
                onChange={(e) => setGenerateQr(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <AnimatePresence>
            {generateQr && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="p-4 bg-blue-50/40 border border-blue-100 rounded-xl grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                      <Building size={11} className="text-blue-500" /> Target Clinic
                    </label>
                    <select
                      className="input text-xs py-2 px-2 bg-white border border-slate-200 rounded-lg outline-none"
                      value={clinicName}
                      onChange={(e) => setClinicName(e.target.value)}
                    >
                      {CLINIC_OPTIONS.map((clinic) => (
                        <option key={clinic} value={clinic}>{clinic}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                      <Calendar size={11} className="text-blue-500" /> Date
                    </label>
                    <input
                      type="date"
                      className="input text-xs py-1.5 px-2 bg-white border border-slate-200 rounded-lg outline-none cursor-pointer"
                      value={appointmentDate}
                      onChange={(e) => setAppointmentDate(e.target.value)}
                      onClick={(e) => {
                        try {
                          e.currentTarget.showPicker();
                        } catch {}
                      }}
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                      <Clock size={11} className="text-blue-500" /> Available Slot
                    </label>
                    <select
                      className="input text-xs py-2 px-2 bg-white border border-slate-200 rounded-lg outline-none"
                      value={appointmentSlot}
                      onChange={(e) => setAppointmentSlot(e.target.value as AppointmentSlot)}
                    >
                      {availableSlots.length > 0 ? (
                        availableSlots.map((slot) => (
                          <option key={slot} value={slot}>{slot}</option>
                        ))
                      ) : (
                        <option disabled>No slots available</option>
                      )}
                    </select>
                  </div>
                </div>

                {/* Generated QR Code directly inside the form container for smooth usage */}
                {lastSavedEntry && lastSavedEntry.appointmentStatus === "booked" && lastSavedEntry.qrPayload && (
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="mt-4 p-4 bg-white border border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center gap-3 max-w-sm mx-auto"
                  >
                    <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-inner inline-flex">
                      <QRCodeCanvas
                        id="qr-canvas-crm"
                        value={getPatientQrCodeUrl(lastSavedEntry.qrToken!)}
                        size={130}
                      />
                    </div>
                    <div className="w-full">
                      <h4 className="font-bold text-slate-800 text-xs">{lastSavedEntry.patientName}</h4>
                      <p className="text-[10px] text-slate-400 font-bold">Token: {lastSavedEntry.qrToken}</p>
                      <p className="text-[11px] text-blue-600 font-bold mt-0.5">
                        {lastSavedEntry.assignedBranch} • {lastSavedEntry.nextFollowUpDate} • {lastSavedEntry.nextFollowUpTime}
                      </p>

                      {/* Displaying clinic address, maps, phone direct */}
                      <div className="mt-3 text-left bg-blue-50/20 p-3 rounded-xl border border-slate-100 text-[11px] font-semibold text-slate-600 stack gap-1.5 max-w-sm mx-auto">
                        <div className="flex items-center gap-1.5">
                          <Phone size={10} className="text-blue-500 shrink-0" />
                          <span>{getBranchDetails(lastSavedEntry.assignedBranch).phone}</span>
                        </div>
                        <div className="flex items-start gap-1.5">
                          <MapPin size={10} className="text-blue-500 shrink-0 mt-0.5" />
                          <span className="leading-tight">{getBranchDetails(lastSavedEntry.assignedBranch).address}</span>
                        </div>
                        <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-250 mt-1">
                          <a
                            href={getBranchDetails(lastSavedEntry.assignedBranch).locationLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 font-bold hover:underline flex items-center gap-0.5"
                          >
                            🗺️ Google Maps Location
                          </a>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 justify-center w-full mt-1">
                      <button
                        type="button"
                        onClick={() => copyCanvasToClipboard("qr-canvas-crm")}
                        className="py-1.5 px-2 bg-blue-50 hover:bg-blue-100 text-[10px] font-bold text-blue-700 rounded-lg flex items-center gap-1 transition-all shadow-xs"
                        title="Copy actual QR image"
                      >
                        <Copy size={11} /> Copy QR
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadCanvasImage("qr-canvas-crm", `Patient-QR-${lastSavedEntry.id}`)}
                        className="py-1.5 px-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-[10px] font-bold text-slate-600 rounded-lg flex items-center gap-1 transition-all shadow-xs"
                      >
                        <Download size={11} /> Download
                      </button>
                      <button
                        type="button"
                        onClick={() => shareToWhatsApp(lastSavedEntry, "qr-canvas-crm")}
                        className="py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-[10px] font-bold text-emerald-700 rounded-lg flex items-center gap-1 transition-all shadow-xs"
                      >
                        <Share2 size={11} /> WhatsApp
                      </button>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Seamless Follow-up check / slide option */}
          <div className="border-t border-slate-100 pt-4 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-slate-800">Schedule Follow-up Call</span>
              <span className="text-xs text-slate-500 font-medium">Set a reminder to callback this patient at a specific date and time</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={scheduleFollowUp}
                onChange={(e) => setScheduleFollowUp(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <AnimatePresence>
            {scheduleFollowUp && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="p-4 bg-amber-50/40 border border-amber-100 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                      <Calendar size={11} className="text-amber-600" /> Follow-up Date
                    </label>
                    <input
                      type="date"
                      className="input text-xs py-1.5 px-2 bg-white border border-slate-200 rounded-lg outline-none cursor-pointer"
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                      onClick={(e) => {
                        try {
                          e.currentTarget.showPicker();
                        } catch {}
                      }}
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                      <Clock size={11} className="text-amber-600" /> Follow-up Time
                    </label>
                    <input
                      type="time"
                      className="input text-xs py-1.5 px-2 bg-white border border-slate-200 rounded-lg outline-none cursor-pointer"
                      value={followUpTime}
                      onChange={(e) => setFollowUpTime(e.target.value)}
                      onClick={(e) => {
                        try {
                          e.currentTarget.showPicker();
                        } catch {}
                      }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="submit"
            className="py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 mt-2 flex items-center justify-center gap-2"
          >
            <Check size={16} /> Save
          </button>
        </form>
      </div>

      {/* Advanced search and filter panel */}
      <div className="card p-4 bg-white border border-slate-100 rounded-2xl shadow-sm flex flex-col md:flex-row items-center gap-3">
        <div className="inline rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1.5 w-full md:max-w-xs shrink-0">
          <Search size={14} className="text-[#6B7280]" />
          <input
            className="bg-transparent text-xs outline-none w-full"
            placeholder="Search leads, names, mobile..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="grid grid-cols-3 gap-2 w-full">
          <select
            className="input py-1.5 px-2.5 text-xs border border-slate-200 bg-white"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">🔍 All Call Statuses</option>
            <option value="new_lead">New Leads</option>
            <option value="callback_requested">Callback Scheduled</option>
            <option value="interested">Interested</option>
            <option value="appointment_booked">Appointment Booked</option>
            <option value="trial_started">Hearing Aid Trial Active</option>
            <option value="spam">Flagged Spam</option>
          </select>

          <select
            className="input py-1.5 px-2.5 text-xs border border-slate-200 bg-white"
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
          >
            <option value="all">🏢 All Clinic Branches</option>
            {CLINIC_OPTIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            className="input py-1.5 px-2.5 text-xs border border-slate-200 bg-white"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="all">⚠️ All Priorities</option>
            <option value="high">High Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="low">Low Priority</option>
          </select>
        </div>
      </div>

      {/* Simplified, Clean Patient Directory Table */}
      <SectionCard title="Recent Patient Registrations">
        <DataTable
          headers={[
            "ID",
            "Name",
            "Mobile",
            "City",
            "Call Response",
            "Comment / Notes",
            "Appointment Details",
            "QR Token",
          ]}
          hasRows={filteredLeads.length > 0}
          empty="No patient registrations yet."
        >
          {filteredLeads.map((entry) => (
            <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors">
              <td className="font-semibold text-slate-700">{entry.id}</td>
              <td><PatientNameButton patient={entry} /></td>
              <td className="text-slate-600 font-medium">{entry.mobileNumber}</td>
              <td className="text-slate-600 font-medium">{entry.city}</td>
              <td>{getStatusBadge(entry.status)}</td>
              <td className="text-slate-500 text-xs max-w-[220px] truncate" title={entry.notes}>
                {entry.notes}
              </td>
              <td className="text-slate-600 font-semibold text-xs">
                {entry.appointmentStatus === "booked" ? (
                  <span className="text-indigo-600 bg-indigo-50/50 px-2 py-1 rounded border border-indigo-100/50">
                    Appt: {entry.assignedBranch} ({entry.nextFollowUpDate} {entry.nextFollowUpTime})
                  </span>
                ) : entry.nextFollowUpDate ? (
                  <span className="text-amber-600 bg-amber-50/50 px-2 py-1 rounded border border-amber-100/50">
                    Follow-up: {entry.nextFollowUpDate} ({entry.nextFollowUpTime})
                  </span>
                ) : (
                  <span className="text-slate-400 font-medium">-</span>
                )}
              </td>
              <td>
                {entry.qrToken ? (
                  <span className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-xs border border-slate-200">
                    {entry.qrToken}
                  </span>
                ) : (
                  <span className="text-slate-300">-</span>
                )}
              </td>
            </tr>
          ))}
        </DataTable>
      </SectionCard>

      {/* AUTOMATIC POPUP MODAL ON QR GENERATION */}
      <AnimatePresence>
        {qrModalEntry && qrModalEntry.qrPayload && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[9999] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white p-6 rounded-2xl shadow-xl max-w-sm w-full border border-slate-100 text-center relative stack gap-4 animate-fade-in"
            >
              <button
                type="button"
                onClick={() => setQrModalEntry(null)}
                className="absolute top-3 right-3 p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-700 transition-all border-none bg-transparent cursor-pointer"
              >
                <X size={16} />
              </button>
              
              <h3 className="font-black text-slate-800 text-base border-b border-slate-100 pb-2.5 mt-2 flex items-center justify-center gap-1.5 text-emerald-600">
                🎉 Appointment QR Code Ready!
              </h3>

              <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-inner inline-flex mx-auto">
                <QRCodeCanvas
                  id="qr-canvas-modal-crm"
                  value={getPatientQrCodeUrl(qrModalEntry.qrToken!)}
                  size={150}
                />
              </div>

              <div>
                <h4 className="font-bold text-slate-800 text-sm">{qrModalEntry.patientName}</h4>
                <div className="bg-slate-100/80 rounded-lg px-2.5 py-1.5 inline-block border border-slate-200 mt-1">
                  <span className="text-xs font-black text-blue-700">Token: {qrModalEntry.qrToken}</span>
                </div>
                <p className="text-xs text-blue-600 font-bold mt-2">
                  {qrModalEntry.assignedBranch} • {qrModalEntry.nextFollowUpDate} • {qrModalEntry.nextFollowUpTime}
                </p>

                {/* Branch details displayed directly inside the modal */}
                <div className="mt-3.5 text-left bg-blue-50/20 p-3.5 rounded-xl border border-slate-100 text-xs font-semibold text-slate-600 stack gap-2 max-w-sm mx-auto">
                  <div className="flex items-center gap-2">
                    <Phone size={12} className="text-blue-500 shrink-0" />
                    <span>{getBranchDetails(qrModalEntry.assignedBranch).phone}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin size={12} className="text-blue-500 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{getBranchDetails(qrModalEntry.assignedBranch).address}</span>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-150 mt-1">
                    <a
                      href={getBranchDetails(qrModalEntry.assignedBranch).locationLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 font-black hover:underline flex items-center gap-1 text-[11px]"
                    >
                      🗺️ View on Google Maps
                    </a>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 justify-center border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => copyCanvasToClipboard("qr-canvas-modal-crm")}
                  className="py-1.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer border-none"
                  title="Copy actual QR image"
                >
                  <Copy size={11} /> Copy QR Image
                </button>
                <button
                  type="button"
                  onClick={() => downloadCanvasImage("qr-canvas-modal-crm", `Appointment-QR-${qrModalEntry.id}`)}
                  className="py-1.5 px-3 bg-slate-150 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer border-none"
                >
                  <Download size={11} /> Download
                </button>
                <button
                  type="button"
                  onClick={() => shareToWhatsApp(qrModalEntry, "qr-canvas-modal-crm")}
                  className="py-1.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer border-none"
                  title="Open WhatsApp & send QR"
                >
                  <Share2 size={11} /> Send WhatsApp
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
}
