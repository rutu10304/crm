import { useMemo, useState, useEffect } from "react";
import { PageHeader } from "../../components/erp/PageHeader";
import { SectionCard } from "../../components/erp/SectionCard";
import { DataTable } from "../../components/erp/DataTable";
import { PatientNameButton } from "../../components/patient/PatientNameButton";
import { useToast } from "../../layout/ToastProvider";
import { useAuth } from "../../auth/AuthContext";
import { api } from "../../services/api";
import {
  listAppointments,
  updateAppointmentStatus,
  type AppointmentRecord,
} from "../../data/appointmentStore";
import {
  listQueueEntries,
  addQueueEntry,
  type QueueEntry,
} from "../../data/queueStore";
import { readReceptionDaySummary } from "../../data/receptionStore";
import {
  Calendar,
  Users,
  CheckCircle,
  CreditCard,
} from "lucide-react";

export function FrontOfficeDashboard() {
  const { session } = useAuth();
  const { pushToast } = useToast();

  const [appointments, setAppointments] = useState<AppointmentRecord[]>(() =>
    listAppointments(),
  );
  const [queueEntries, setQueueEntries] = useState<QueueEntry[]>(() =>
    listQueueEntries(),
  );

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const activeClinicDisplay = useMemo(() => {
    if (!session?.clinicName || session.clinicName === "Pilot Branch") {
      return "Delhi Gate";
    }
    return session.clinicName;
  }, [session]);

  // Load appointments and queue entries from database if online
  useEffect(() => {
    async function loadDbData() {
      try {
        const appts = await api.appointments.list();
        setAppointments(appts);
      } catch (err) {
        console.log("[FrontOfficeDashboard] Backend offline, using local appointments.");
      }
      try {
        const queue = await api.queue.list();
        setQueueEntries(queue);
      } catch (err) {
        console.log("[FrontOfficeDashboard] Backend offline, using local queue.");
      }
    }
    loadDbData();
  }, []);

  // Today's appointments for active clinic
  const todayAppointments = useMemo(() => {
    return appointments.filter(
      (record) =>
        record.date === todayStr &&
        record.clinicName.toLowerCase() === activeClinicDisplay.toLowerCase(),
    );
  }, [appointments, todayStr, activeClinicDisplay]);

  // Lobby queue for active clinic
  const clinicQueue = useMemo(() => {
    return queueEntries.filter(
      (entry) => entry.clinicName.toLowerCase() === activeClinicDisplay.toLowerCase(),
    );
  }, [queueEntries, activeClinicDisplay]);

  const activeWaitingQueue = useMemo(() => {
    return clinicQueue.filter((entry) => entry.status === "waiting");
  }, [clinicQueue]);

  const readEodSummary = useMemo(() => {
    return readReceptionDaySummary();
  }, []);

  // Quick check-in for reception dashboard
  async function handleReceptionQuickArrive(record: AppointmentRecord) {
    try {
      await api.appointments.updateStatus(record.id, "arrived");
      
      const lobbyQueue = await api.queue.list();
      const alreadyInQueue = lobbyQueue.some(
        (entry) =>
          entry.patientName.toLowerCase() === record.patientName.toLowerCase() &&
          entry.status === "waiting",
      );

      if (!alreadyInQueue) {
        await api.queue.add({
          patientName: record.patientName,
          clinicName: record.clinicName,
          status: "waiting",
          mobileNumber: record.mobileNumber,
          arrivalType: "appointment",
        });
      }
      
      const appts = await api.appointments.list();
      const queue = await api.queue.list();
      setAppointments(appts);
      setQueueEntries(queue);
    } catch (err) {
      console.log("Database offline, check-in processed locally.");
      const updated = updateAppointmentStatus(record.id, "arrived");
      setAppointments(updated);

      const lobbyQueue = listQueueEntries();
      const alreadyInQueue = lobbyQueue.some(
        (entry) =>
          entry.patientName.toLowerCase() === record.patientName.toLowerCase() &&
          entry.status === "waiting",
      );

      if (!alreadyInQueue) {
        addQueueEntry({
          patientName: record.patientName,
          clinicName: record.clinicName,
          status: "waiting",
          mobileNumber: record.mobileNumber,
          arrivalType: "appointment",
        });
        setQueueEntries(listQueueEntries());
      }
    }
    pushToast(`${record.patientName} check-in processed and added to active lobby queue.`, "success");
  }

  return (
    <section className="stack animate-fade-in">
      <PageHeader
        title="Reception Desk Dashboard"
        subtitle={`Welcome back, ${session?.fullName}. Managing front office operations, patient flows, and schedules for ${activeClinicDisplay}.`}
      />

      {/* Executive Stats Block */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4 bg-white border border-slate-100 rounded-2xl flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Calendar size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Today's Bookings</p>
            <p className="text-xl font-bold text-slate-800">{todayAppointments.length}</p>
          </div>
        </div>
        <div className="card p-4 bg-white border border-slate-100 rounded-2xl flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Users size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Lobby Waiting Queue</p>
            <p className="text-xl font-bold text-slate-800">{activeWaitingQueue.length}</p>
          </div>
        </div>
        <div className="card p-4 bg-white border border-slate-100 rounded-2xl flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Check-Ins Completed</p>
            <p className="text-xl font-bold text-slate-800">{queueEntries.filter(q => q.clinicName.toLowerCase() === activeClinicDisplay.toLowerCase()).length}</p>
          </div>
        </div>
        <div className="card p-4 bg-white border border-slate-100 rounded-2xl flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <CreditCard size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Registry Collections</p>
            <p className="text-xl font-bold text-slate-800">
              {readEodSummary ? `INR ${readEodSummary.physicalCash + readEodSummary.onlineCollected}` : "INR 0"}
            </p>
          </div>
        </div>
      </div>

      {/* Dashboard Workflows */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Today's Clinic Arrival Schedule" subtitle="Instant check-in and lobby arrivals for scheduled bookings.">
          <DataTable
            headers={["Token/ID", "Patient", "Mobile", "Slot", "Actions"]}
            hasRows={todayAppointments.length > 0}
            empty="No appointments scheduled for today."
          >
            {todayAppointments.map((entry) => (
              <tr key={entry.id}>
                <td className="font-mono text-xs font-bold text-slate-500">{entry.id}</td>
                <td><PatientNameButton patient={entry} /></td>
                <td className="text-slate-600 font-medium">{entry.mobileNumber}</td>
                <td className="text-xs text-blue-600 font-bold">{entry.slot}</td>
                <td>
                  {entry.status === "booked" || entry.status === "packed" ? (
                    <button
                      onClick={() => handleReceptionQuickArrive(entry)}
                      className="py-1 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-black rounded-lg transition-all border-none cursor-pointer"
                      type="button"
                    >
                      Quick Arrive
                    </button>
                  ) : (
                    <span className="text-xs font-bold text-slate-400 italic">Checked In</span>
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        </SectionCard>

        <SectionCard title="Active Clinic Lobby Flow" subtitle="Live patient waiting queue for audiologists and test cabins.">
          <DataTable
            headers={["Patient", "Lobby Status", "Arrival Mode", "Cabin Status"]}
            hasRows={clinicQueue.length > 0}
            empty="No patients currently in lobby."
          >
            {clinicQueue.map((entry) => (
              <tr key={entry.id}>
                <td><PatientNameButton patient={entry} /></td>
                <td>
                  <span className={`badge ${entry.status === "waiting" ? "warn" : "ok"}`}>
                    {entry.status === "waiting" ? "Waiting in Lobby" : "In Cabinet"}
                  </span>
                </td>
                <td>
                  <span className="text-xs font-semibold text-slate-500 capitalize">
                    {entry.arrivalType?.replace("_", " ") || "Appointment"}
                  </span>
                </td>
                <td className="text-xs font-bold text-blue-600 uppercase">{entry.status}</td>
              </tr>
            ))}
          </DataTable>
        </SectionCard>
      </div>
    </section>
  );
}
