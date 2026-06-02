import { type FormEvent, useState } from "react";
import { findEntryByQrToken, type TelecallerEntry } from "../../data/telecallerStore";
import {
  createAppointment,
  getAvailableSlots,
  listAppointments,
  updateAppointmentStatus,
  type AppointmentSlot,
  type AppointmentRecord,
} from "../../data/appointmentStore";
import { addQueueEntry } from "../../data/queueStore";
import { useAuth } from "../../auth/AuthContext";
import {
  readReceptionDaySummary,
  saveReceptionDaySummary,
} from "../../data/receptionStore";
import { DataTable } from "../../components/erp/DataTable";
import { PageHeader } from "../../components/erp/PageHeader";
import { SectionCard } from "../../components/erp/SectionCard";
import { useToast } from "../../layout/ToastProvider";
import { api } from "../../services/api";
import { extractQrTokenFromScan, parsePatientQrPayload } from "../../utils/patientQr";

const arrivalOptions = ["walk_in", "appointment", "call_converted"] as const;
type ArrivalType = (typeof arrivalOptions)[number];

interface CheckIn {
  token: string;
  patient: string;
  mobile: string;
  arrivalType: ArrivalType;
  waitingSince: string;
}

export function ReceptionCheckInPage() {
  const { session } = useAuth();
  const { pushToast } = useToast();
  const [entries, setEntries] = useState<CheckIn[]>([]);
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("");
  const [patient, setPatient] = useState("");
  const [mobile, setMobile] = useState("");
  const [referenceSource, setReferenceSource] = useState("");
  const [visitReason, setVisitReason] = useState("");
  const [mobileVerified, setMobileVerified] = useState(false);
  const [openingReady, setOpeningReady] = useState(false);
  const [openingCash, setOpeningCash] = useState(0);
  const [arrivalType, setArrivalType] = useState<ArrivalType>("walk_in");
  const [walkInDate, setWalkInDate] = useState(new Date().toISOString().slice(0, 10));
  const [walkInSlot, setWalkInSlot] = useState<AppointmentSlot>("10:00 AM");
  const [scanToken, setScanToken] = useState("");
  const [scanError, setScanError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [linkedEntry, setLinkedEntry] = useState<TelecallerEntry | null>(null);
  const [physicalCash, setPhysicalCash] = useState(0);
  const [onlineCollected, setOnlineCollected] = useState(0);
  const [salesCount, setSalesCount] = useState(0);
  const [trialsCount, setTrialsCount] = useState(0);
  const [pendingFollowUps, setPendingFollowUps] = useState(0);
  const [eodMessage, setEodMessage] = useState("");

  const todaySummary = readReceptionDaySummary();

  async function submitCheckIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveError("");
    if (!patient.trim() || !mobile.trim()) return;
    if (!openingReady) {
      setSaveError("Complete opening controls before handling patient.");
      return;
    }
    if (!mobileVerified) {
      setSaveError("Please verify mobile number before saving.");
      return;
    }

    const clinic = session?.clinicName ?? "Pilot Branch";

    if (arrivalType === "walk_in") {
      try {
        const available = await api.appointments.getAvailableSlots(clinic, walkInDate);
        if (!available.includes(walkInSlot)) {
          setSaveError("Selected walk-in slot is already packed.");
          return;
        }
        const slotRes = await api.appointments.create({
          patientName: patient.trim(),
          mobileNumber: mobile.trim(),
          clinicName: clinic,
          date: walkInDate,
          slot: walkInSlot,
          source: "walk_in_block",
          status: "packed",
          bookedBy: session?.fullName ?? "Reception",
        });
        if (slotRes && !slotRes.ok) {
          setSaveError(slotRes.reason || "Slot already booked.");
          return;
        }
      } catch (err) {
        console.log("Database offline, reserving walk-in slot locally.");
        const available = getAvailableSlots(clinic, walkInDate);
        if (!available.includes(walkInSlot)) {
          setSaveError("Selected walk-in slot is already packed.");
          return;
        }
        const slotReservation = createAppointment({
          patientName: patient.trim(),
          mobileNumber: mobile.trim(),
          clinicName: clinic,
          date: walkInDate,
          slot: walkInSlot,
          source: "walk_in_block",
          status: "packed",
          bookedBy: session?.fullName ?? "Reception",
        });
        if (!slotReservation.ok) {
          setSaveError(slotReservation.reason);
          return;
        }
      }
    }

    try {
      await api.queue.add({
        patientName: patient.trim(),
        clinicName: clinic,
        status: "waiting",
        mobileNumber: mobile.trim(),
        arrivalType,
      });

      if (arrivalType === "appointment") {
        const allAppts = await api.appointments.list();
        const matched = allAppts.find(
          (a) =>
            a.status !== "arrived" &&
            a.status !== "completed" &&
            (a.mobileNumber === mobile.trim() ||
              a.patientName.toLowerCase() === patient.trim().toLowerCase() ||
              (scanToken && a.id === scanToken)),
        );
        if (matched) {
          await api.appointments.updateStatus(matched.id, "arrived");
        }
      }
      
    } catch (err) {
      console.log("Database offline, checking in locally.");
      addQueueEntry({
        patientName: patient.trim(),
        clinicName: clinic,
        status: "waiting",
        mobileNumber: mobile.trim(),
        arrivalType,
      });

      if (arrivalType === "appointment") {
        const allAppts: AppointmentRecord[] = listAppointments();
        const matched = allAppts.find(
          (a: AppointmentRecord) =>
            a.status !== "arrived" &&
            a.status !== "completed" &&
            (a.mobileNumber === mobile.trim() ||
              a.patientName.toLowerCase() === patient.trim().toLowerCase() ||
              (scanToken && a.id === scanToken)),
        );
        if (matched) {
          updateAppointmentStatus(matched.id, "arrived");
        }
      }
    }

    const token = `T-${String(entries.length + 1).padStart(3, "0")}`;
    const waitingSince = new Date().toLocaleTimeString();
    setEntries((prev) => [...prev, { token, patient: patient.trim(), mobile: mobile.trim(), arrivalType, waitingSince }]);
    
    if (arrivalType === "walk_in") {
      pushToast("Walk-in slot packed and queue updated.", "success");
    } else {
      pushToast("Patient marked arrived and added to queue.", "success");
    }

    setFullName("");
    setAge("");
    setPatient("");
    setMobile("");
    setReferenceSource("");
    setVisitReason("");
    setMobileVerified(false);
  }

  async function scanAppointmentToken() {
    setScanError("");

    const parsedQr = parsePatientQrPayload(scanToken);
    const tokenLookup = extractQrTokenFromScan(scanToken);

    if (parsedQr) {
      setLinkedEntry({
        id: parsedQr.patientId,
        patientName: parsedQr.patientName,
        mobileNumber: parsedQr.mobileNumber,
        clinicName: parsedQr.assignedBranch ?? "",
        appointmentDate: parsedQr.appointmentDate ?? "",
        appointmentSlot: parsedQr.appointmentSlot ?? "",
        qrToken: parsedQr.qrToken,
      } as TelecallerEntry);
      setPatient(parsedQr.patientName);
      setFullName(parsedQr.patientName);
      setMobile(parsedQr.mobileNumber);
      setArrivalType("appointment");
      setReferenceSource("Telecaller");
      return;
    }

    // Try database check first
    try {
      const dbRes = await api.telecaller.findByQrToken(tokenLookup);
      if (dbRes.found && dbRes.entry) {
        const found = dbRes.entry;
        setLinkedEntry(found);
        setPatient(found.patientName);
        setFullName(found.patientName);
        setMobile(found.mobileNumber);
        setArrivalType("appointment");
        setReferenceSource("Telecaller");
        return;
      }
    } catch (err) {
      console.log("Database offline, scanning locally.");
    }

    // Fallback to local
    const found = findEntryByQrToken(tokenLookup);
    if (!found) {
      setLinkedEntry(null);
      setScanError("No appointment found for this token.");
      return;
    }

    setLinkedEntry(found);
    setPatient(found.patientName);
    setFullName(found.patientName);
    setMobile(found.mobileNumber);
    setArrivalType("appointment");
    setReferenceSource("Telecaller");
  }

  async function saveEodSummary() {
    const expectedCash = openingCash + salesCount * 1000;
    const cashMatches = physicalCash === expectedCash;

    const summaryData = {
      date: new Date().toISOString().slice(0, 10),
      expectedCash,
      physicalCash,
      onlineCollected,
      footfall: entries.length,
      trials: trialsCount,
      sales: salesCount,
      pendingFollowUps,
    };

    // Save to database if online
    try {
      await api.reception.saveSummary(summaryData);
    } catch (err) {
      console.log("Database offline, saving summary locally.");
    }

    saveReceptionDaySummary(summaryData);

    if (!cashMatches) {
      setEodMessage("Cash mismatch detected. Inform branch head immediately.");
      pushToast("Cash mismatch detected for EOD.", "error");
      return;
    }

    setEodMessage("Daily summary saved. Cash matched with system.");
    pushToast("EOD summary saved successfully.", "success");
  }

  return (
    <section className="stack">
      <PageHeader
        title="Reception Operations Console"
        subtitle="Opening controls, QR/manual check-in, queue management, and end-of-day controls."
      />

      <SectionCard
        title="QR Appointment Scan"
        subtitle="Scan QR token shared by telecaller on WhatsApp to auto-load patient and appointment details."
      >
        <div className="inline">
          <input
            className="input"
            placeholder="Enter scanned QR token (example: ST-001)"
            value={scanToken}
            onChange={(event) => setScanToken(event.target.value)}
          />
          <button className="button ghost" type="button" onClick={scanAppointmentToken}>
            Scan Token
          </button>
        </div>
        {scanError ? <p className="error">{scanError}</p> : null}
        {linkedEntry ? (
          <div className="scan-result">
            <strong>Matched Appointment</strong>
            <p>
              {linkedEntry.patientName} - {linkedEntry.clinicName} - {linkedEntry.appointmentDate}{" "}
              {linkedEntry.appointmentSlot}
            </p>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title="Opening Controls">
        <div className="grid two">
          <label className="inline">
            <input
              type="checkbox"
              checked={openingReady}
              onChange={(event) => setOpeningReady(event.target.checked)}
            />
            CRM/system checked and appointment list reviewed
          </label>
          <input
            className="input"
            type="number"
            value={openingCash}
            onChange={(event) => setOpeningCash(Number(event.target.value))}
            placeholder="Opening cash balance"
          />
        </div>
      </SectionCard>

      <form id="check-in-form" className="card glass stack compact" onSubmit={submitCheckIn}>
        <h2>Manual / Auto Check-In</h2>
        <div className="grid two">
          <input className="input" value={fullName} onChange={(e) => { setFullName(e.target.value); setPatient(e.target.value); }} placeholder="Full name" />
          <input className="input" value={age} onChange={(e) => setAge(e.target.value)} placeholder="Age" />
          <input className="input" value={patient} onChange={(e) => setPatient(e.target.value)} placeholder="Patient display name" />
          <input className="input" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="Mobile number" />
          <input className="input" value={referenceSource} onChange={(e) => setReferenceSource(e.target.value)} placeholder="Reference source" />
          <input className="input" value={visitReason} onChange={(e) => setVisitReason(e.target.value)} placeholder="Reason for visit" />
          <label className="inline">
            <input
              type="checkbox"
              checked={mobileVerified}
              onChange={(event) => setMobileVerified(event.target.checked)}
            />
            Mobile number verified
          </label>
          <select className="input" value={arrivalType} onChange={(e) => setArrivalType(e.target.value as ArrivalType)}>
            {arrivalOptions.map((opt) => <option key={opt} value={opt}>{opt.replace("_", " ")}</option>)}
          </select>
          {arrivalType === "walk_in" ? (
            <>
              <input
                className="input cursor-pointer"
                type="date"
                value={walkInDate}
                onChange={(event) => setWalkInDate(event.target.value)}
                onClick={(e) => {
                  try {
                    e.currentTarget.showPicker();
                  } catch {}
                }}
              />
              <select
                className="input"
                value={walkInSlot}
                onChange={(event) =>
                  setWalkInSlot(event.target.value as AppointmentSlot)
                }
              >
                {getAvailableSlots(
                  session?.clinicName ?? "Pilot Branch",
                  walkInDate,
                ).map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
            </>
          ) : null}
          {saveError ? <p className="error">{saveError}</p> : null}
          <button className="button primary" type="submit">Mark Arrived</button>
        </div>
      </form>

      <SectionCard title="Arrivals Queue">
        <DataTable
          headers={["Token", "Patient", "Mobile", "Type", "Waiting Since"]}
          hasRows={entries.length > 0}
          empty="No check-ins yet."
        >
          {entries.map((entry) => (
            <tr key={entry.token}>
              <td>{entry.token}</td><td>{entry.patient}</td><td>{entry.mobile}</td>
              <td><span className="badge info">{entry.arrivalType}</span></td><td>{entry.waitingSince}</td>
            </tr>
          ))}
        </DataTable>
      </SectionCard>

      <SectionCard title="End-of-Day Controls">
        <div className="grid two">
          <input
            className="input"
            type="number"
            value={salesCount}
            onChange={(event) => setSalesCount(Number(event.target.value))}
            placeholder="Sales count"
          />
          <input
            className="input"
            type="number"
            value={trialsCount}
            onChange={(event) => setTrialsCount(Number(event.target.value))}
            placeholder="Trials count"
          />
          <input
            className="input"
            type="number"
            value={physicalCash}
            onChange={(event) => setPhysicalCash(Number(event.target.value))}
            placeholder="Physical cash"
          />
          <input
            className="input"
            type="number"
            value={onlineCollected}
            onChange={(event) => setOnlineCollected(Number(event.target.value))}
            placeholder="Online collected"
          />
          <input
            className="input"
            type="number"
            value={pendingFollowUps}
            onChange={(event) => setPendingFollowUps(Number(event.target.value))}
            placeholder="Pending follow-ups"
          />
          <button className="button primary" type="button" onClick={saveEodSummary}>
            Save Daily Summary
          </button>
        </div>
        {eodMessage ? <p className={eodMessage.includes("mismatch") ? "error" : "success"}>{eodMessage}</p> : null}
        {todaySummary ? (
          <p className="muted">
            Last saved summary - {todaySummary.date}, Footfall: {todaySummary.footfall}, Cash:
            {" "}INR {todaySummary.physicalCash}
          </p>
        ) : null}
      </SectionCard>
    </section>
  );
}
