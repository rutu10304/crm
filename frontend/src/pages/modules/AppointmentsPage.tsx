import { useMemo, useState, useEffect } from "react";
import {
  listAppointments,
  type AppointmentRecord,
} from "../../data/appointmentStore";
import { DataTable } from "../../components/erp/DataTable";
import { PageHeader } from "../../components/erp/PageHeader";
import { PatientNameButton } from "../../components/patient/PatientNameButton";
import { SectionCard } from "../../components/erp/SectionCard";
import { useToast } from "../../layout/ToastProvider";
import { QRCodeCanvas } from "qrcode.react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Share2, Copy, X, Phone, MapPin } from "lucide-react";
import { api } from "../../services/api";
import { getPatientQrCodeUrl, persistPatientQr } from "../../utils/patientQr";
import { normalizePatientProfile } from "../../types/patient";

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

export function AppointmentsPage() {
  const { pushToast } = useToast();
  const [appointments, setAppointments] = useState<AppointmentRecord[]>(() =>
    listAppointments(),
  );

  // Load appointments from database on mount if available
  useEffect(() => {
    async function loadAppointments() {
      try {
        const data = await api.appointments.list();
        setAppointments(data);
        if (data.length > 0 && !lastBookedRecord) {
          setLastBookedRecord(data[0]);
        }
      } catch (err) {
        console.log("[Appointments] Backend offline, using local storage.");
      }
    }
    loadAppointments();
  }, []);

  // Track the selected appointment to render its live QR code on the bottom card
  const [lastBookedRecord, setLastBookedRecord] = useState<AppointmentRecord | null>(() => {
    // Default to the first appointment if available
    return appointments.length > 0 ? appointments[0] : null;
  });

  // Selected appointment for the modal popup when clicking "Open"
  const [selectedQrRecord, setSelectedQrRecord] = useState<AppointmentRecord | null>(null);

  function syncAppointmentQr(record: AppointmentRecord) {
    persistPatientQr(
      normalizePatientProfile({
        id: record.id,
        patientName: record.patientName,
        mobileNumber: record.mobileNumber,
        assignedBranch: record.clinicName,
        nextFollowUpDate: record.date,
        nextFollowUpTime: record.slot,
        appointmentStatus: record.status,
        qrToken: record.id,
      }),
      record.id
    );
  }

  const qrScanUrl = useMemo(
    () => (lastBookedRecord ? getPatientQrCodeUrl(lastBookedRecord.id) : ""),
    [lastBookedRecord]
  );

  const modalQrScanUrl = useMemo(
    () => (selectedQrRecord ? getPatientQrCodeUrl(selectedQrRecord.id) : ""),
    [selectedQrRecord]
  );

  useEffect(() => {
    if (lastBookedRecord) syncAppointmentQr(lastBookedRecord);
  }, [lastBookedRecord]);

  useEffect(() => {
    if (selectedQrRecord) syncAppointmentQr(selectedQrRecord);
  }, [selectedQrRecord]);

  function handleCopyDetails(record: AppointmentRecord) {
    const bDetails = getBranchDetails(record.clinicName);
    const detailsText = `📝 Appointment Confirmed!
🎫 Token Number: ${record.id}
👤 Patient: ${record.patientName}
📞 Contact: ${record.mobileNumber}
🏢 Clinic: ${record.clinicName}
📅 Date: ${record.date}
⏰ Slot: ${record.slot}

🏢 Clinic Address: ${bDetails.address}
📞 Clinic Phone: ${bDetails.phone}
🗺️ Google Location: ${bDetails.locationLink}`;

    navigator.clipboard.writeText(detailsText);
    pushToast("Appointment and branch details copied directly!", "success");
  }

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

  function shareToWhatsApp(record: AppointmentRecord, canvasId: string) {
    const bDetails = getBranchDetails(record.clinicName);
    const detailsText = `📝 *Softone ERP - Appointment Confirmed!*
🎫 *Token Number:* ${record.id}
👤 *Patient:* ${record.patientName}
📞 *Contact:* ${record.mobileNumber}
🏢 *Clinic:* ${record.clinicName}
📅 *Date:* ${record.date}
⏰ *Slot:* ${record.slot}

🏢 *Clinic Address:* ${bDetails.address}
📞 *Clinic Phone:* ${bDetails.phone}
🗺 *Google Location:* ${bDetails.locationLink}`;

    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (canvas) {
      try {
        canvas.toBlob((blob) => {
          if (blob) {
            // First send details + instructions via web link
            const textUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(detailsText)}`;
            
            // To make sending the image completely automatic without manual pasting:
            // Modern Web Share API supports sending image blobs directly to apps like WhatsApp on devices that support it.
            const file = new File([blob], "appointment-qr.png", { type: "image/png" });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              navigator.share({
                title: 'Softone Appointment QR',
                text: detailsText,
                files: [file]
              }).then(() => {
                pushToast("Appointment and QR Code shared successfully via WhatsApp!", "success");
              }).catch(() => {
                // Fallback to Clipboard Copy + Open Link if Web Share gets blocked
                navigator.clipboard.write([
                  new ClipboardItem({ "image/png": blob })
                ]).then(() => {
                  window.open(textUrl, "_blank");
                  pushToast("QR Image copied automatically! Just press Paste (Ctrl+V) in WhatsApp.", "success");
                });
              });
            } else {
              // Fallback to Clipboard Copy + Open Link
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

  return (
    <section className="stack">
      <PageHeader
        title="Appointments and Slot Intelligence"
        subtitle="Manage clinic bookings, view today's schedule, and interact with smart patient check-in QR codes."
      />

      <SectionCard title="Today Schedule">
        <DataTable
          headers={["Patient ID", "Name", "Phone Number", "Date & Slot", "Status", "Open"]}
          hasRows={appointments.length > 0}
        >
          {appointments.map((entry) => (
            <tr key={entry.id}>
              <td className="font-mono text-xs font-bold text-slate-500">{entry.id}</td>
              <td><PatientNameButton patient={entry} /></td>
              <td className="text-slate-600 font-medium">{entry.mobileNumber}</td>
              <td className="text-xs text-blue-600 font-bold">
                {entry.clinicName} • {entry.date} ({entry.slot})
              </td>
              <td>
                <span className="badge info">{entry.status}</span>
              </td>
              <td>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedQrRecord(entry);
                    setLastBookedRecord(entry); // Keep active QR card at the bottom in-sync too!
                  }}
                  className="py-1.5 px-3.5 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-black rounded-lg transition-all"
                >
                  Open
                </button>
              </td>
            </tr>
          ))}
        </DataTable>
      </SectionCard>

      <SectionCard title="Active QR Code & Actions">
        {lastBookedRecord ? (
          <div className="flex flex-col items-center justify-center text-center gap-4 py-2">
            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-inner inline-flex animate-fade-in">
              <QRCodeCanvas id="qr-canvas-last" value={qrScanUrl} size={150} />
            </div>
            <div className="w-full">
              <h4 className="font-bold text-slate-800 text-sm">{lastBookedRecord.patientName}</h4>
              <p className="text-[10px] text-slate-400 font-bold">ID: {lastBookedRecord.id}</p>
              <p className="text-xs text-blue-600 font-bold mt-0.5">
                {lastBookedRecord.clinicName} • {lastBookedRecord.date} • {lastBookedRecord.slot}
              </p>

              {/* Branch details displayed directly under the QR code */}
              <div className="mt-3.5 text-left bg-blue-50/20 p-3.5 rounded-xl border border-slate-100 text-xs font-semibold text-slate-600 stack gap-2 max-w-sm mx-auto">
                <div className="flex items-center gap-2">
                  <Phone size={12} className="text-blue-500 shrink-0" />
                  <span>{getBranchDetails(lastBookedRecord.clinicName).phone}</span>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin size={12} className="text-blue-500 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{getBranchDetails(lastBookedRecord.clinicName).address}</span>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-slate-150 mt-1">
                  <a
                    href={getBranchDetails(lastBookedRecord.clinicName).locationLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 font-black hover:underline flex items-center gap-1 text-[11px]"
                  >
                    🗺️ View on Google Maps
                  </a>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
              <button
                type="button"
                onClick={() => handleCopyDetails(lastBookedRecord)}
                className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all"
                title="Copy formatted appointment text details"
              >
                <Copy size={12} /> Copy Details
              </button>
              <button
                type="button"
                onClick={() => copyCanvasToClipboard("qr-canvas-last")}
                className="py-1.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all"
                title="Copy actual QR code image to paste in WhatsApp"
              >
                <Copy size={12} /> Copy QR Image
              </button>
              <button
                type="button"
                onClick={() => downloadCanvasImage("qr-canvas-last", `Appointment-QR-${lastBookedRecord.id}`)}
                className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all"
              >
                <Download size={12} /> Download
              </button>
              <button
                type="button"
                onClick={() => shareToWhatsApp(lastBookedRecord, "qr-canvas-last")}
                className="py-1.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all"
                title="Share details & copy QR to clipboard to paste in WhatsApp"
              >
                <Share2 size={12} /> Share WhatsApp
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-4 py-8 text-center h-full">
            <div className="w-16 h-16 bg-slate-50 border border-dashed border-slate-200 rounded-full flex items-center justify-center text-slate-400">
              <QRCodeCanvas value="None" size={32} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-700">No QR Code Activated Yet</h4>
              <p className="text-xs text-slate-400 max-w-[240px] mx-auto mt-1 font-medium">
                Click "Open" on any appointment above to select and load its active check-in QR code.
              </p>
            </div>
          </div>
        )}
      </SectionCard>

      {/* POPUP MODAL TO REVEAL SPECIFIC QR CODE */}
      <AnimatePresence>
        {selectedQrRecord && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[9999] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white p-6 rounded-2xl shadow-xl max-w-sm w-full border border-slate-100 text-center relative stack gap-4"
            >
              <button
                onClick={() => setSelectedQrRecord(null)}
                className="absolute top-3 right-3 p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-700 transition-all"
              >
                <X size={16} />
              </button>
              
              <h3 className="font-black text-slate-800 text-base border-b border-slate-100 pb-2.5 mt-2">
                Appointment QR Code
              </h3>

              <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-inner inline-flex mx-auto">
                <QRCodeCanvas id="qr-canvas-modal" value={modalQrScanUrl} size={150} />
              </div>

              <div>
                <h4 className="font-bold text-slate-800 text-sm">{selectedQrRecord.patientName}</h4>
                <p className="text-[10px] text-slate-400 font-bold">ID: {selectedQrRecord.id}</p>
                <p className="text-xs text-blue-600 font-bold mt-1">
                  {selectedQrRecord.clinicName} • {selectedQrRecord.date} • {selectedQrRecord.slot}
                </p>

                {/* Branch details displayed directly inside the modal */}
                <div className="mt-3 text-left bg-blue-50/20 p-3.5 rounded-xl border border-slate-100 text-xs font-semibold text-slate-600 stack gap-2 max-w-sm mx-auto">
                  <div className="flex items-center gap-2">
                    <Phone size={12} className="text-blue-500 shrink-0" />
                    <span>{getBranchDetails(selectedQrRecord.clinicName).phone}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin size={12} className="text-blue-500 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{getBranchDetails(selectedQrRecord.clinicName).address}</span>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-150 mt-1">
                    <a
                      href={getBranchDetails(selectedQrRecord.clinicName).locationLink}
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
                  onClick={() => handleCopyDetails(selectedQrRecord)}
                  className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all"
                  title="Copy text details"
                >
                  <Copy size={11} /> Copy Details
                </button>
                <button
                  type="button"
                  onClick={() => copyCanvasToClipboard("qr-canvas-modal")}
                  className="py-1.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all"
                  title="Copy actual QR image"
                >
                  <Copy size={11} /> Copy QR Image
                </button>
                <button
                  type="button"
                  onClick={() => downloadCanvasImage("qr-canvas-modal", `Appointment-QR-${selectedQrRecord.id}`)}
                  className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all"
                >
                  <Download size={11} /> Download
                </button>
                <button
                  type="button"
                  onClick={() => shareToWhatsApp(selectedQrRecord, "qr-canvas-modal")}
                  className="py-1.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all"
                  title="Open WhatsApp & copy QR"
                >
                  <Share2 size={11} /> Share WhatsApp
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
}
