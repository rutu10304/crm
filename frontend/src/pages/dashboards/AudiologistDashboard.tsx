import { useMemo, useState, useEffect } from "react";
import { PageHeader } from "../../components/erp/PageHeader";
import { SectionCard } from "../../components/erp/SectionCard";
import { DataTable } from "../../components/erp/DataTable";
import { PatientNameButton } from "../../components/patient/PatientNameButton";
import { useToast } from "../../layout/ToastProvider";
import { useAuth } from "../../auth/AuthContext";
import { api } from "../../services/api";
import {
  listQueueEntries,
  updateQueueStatus,
  type QueueEntry,
} from "../../data/queueStore";
import {
  Users,
  Stethoscope,
  CheckCircle,
} from "lucide-react";

export function AudiologistDashboard() {
  const { session } = useAuth();
  const { pushToast } = useToast();

  const [queueEntries, setQueueEntries] = useState<QueueEntry[]>(() =>
    listQueueEntries(),
  );

  const activeClinicDisplay = useMemo(() => {
    if (!session?.clinicName || session.clinicName === "Pilot Branch") {
      return "Delhi Gate";
    }
    return session.clinicName;
  }, [session]);

  // Load queue entries from database if online
  useEffect(() => {
    async function loadDbQueue() {
      try {
        const queue = await api.queue.list();
        setQueueEntries(queue);
      } catch (err) {
        console.log("[AudiologistDashboard] Backend offline, using local queue.");
      }
    }
    loadDbQueue();
  }, []);

  // Lobby queue for active clinic
  const clinicQueue = useMemo(() => {
    return queueEntries.filter(
      (entry) => entry.clinicName.toLowerCase() === activeClinicDisplay.toLowerCase(),
    );
  }, [queueEntries, activeClinicDisplay]);

  const activeWaitingQueue = useMemo(() => {
    return clinicQueue.filter((entry) => entry.status === "waiting");
  }, [clinicQueue]);

  const activeTestingQueue = useMemo(() => {
    return clinicQueue.filter((entry) => entry.status === "in_consultation" || entry.status === "testing");
  }, [clinicQueue]);

  const completedTodayQueue = useMemo(() => {
    return clinicQueue.filter((entry) => entry.status === "billing");
  }, [clinicQueue]);

  // Update a patient's status in the clinical queue
  async function handleUpdateQueueStatus(id: string, newStatus: QueueEntry["status"]) {
    try {
      await api.queue.updateStatus(id, newStatus);
      const queue = await api.queue.list();
      setQueueEntries(queue);
    } catch (err) {
      console.log("Database offline, updating queue status locally.");
      const updated = updateQueueStatus(id, newStatus);
      setQueueEntries(updated);
    }
    pushToast(`Queue status updated to ${newStatus.replace("_", " ")}`, "success");
  }

  return (
    <section className="stack animate-fade-in">
      <PageHeader
        title="Clinical Cabin Dashboard"
        subtitle={`Welcome, Dr. ${session?.fullName.replace("Dr.", "")}. Review waiting logs, calibrate testing rooms, and manage audiometry queues.`}
      />

      {/* Clinic Stats Block */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4 bg-white border border-slate-100 rounded-2xl flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Users size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Patients Waiting in Lobby</p>
            <p className="text-xl font-bold text-slate-800">{activeWaitingQueue.length}</p>
          </div>
        </div>
        <div className="card p-4 bg-white border border-slate-100 rounded-2xl flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Stethoscope size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Active Testing / Consultations</p>
            <p className="text-xl font-bold text-slate-800">{activeTestingQueue.length}</p>
          </div>
        </div>
        <div className="card p-4 bg-white border border-slate-100 rounded-2xl flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Completed Consultations Today</p>
            <p className="text-xl font-bold text-slate-800">{completedTodayQueue.length}</p>
          </div>
        </div>
      </div>

      {/* Clinical Cabin Workflows */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Clinical cabin queue */}
        <div className="lg:col-span-2">
          <SectionCard title="Active Consultation & Testing Queue" subtitle="Call lobby patients into the cabinet or refer completed cases to billing.">
            <DataTable
              headers={["Patient Name", "Arrival Mode", "Current State", "Queue Actions"]}
              hasRows={clinicQueue.filter(q => q.status !== "billing").length > 0}
              empty="No active patients awaiting clinical consultation."
            >
              {clinicQueue
                .filter((entry) => entry.status !== "billing")
                .map((entry) => (
                  <tr key={entry.id}>
                    <td><PatientNameButton patient={entry} /></td>
                    <td>
                      <span className="text-xs font-bold text-slate-500 capitalize">
                        {entry.arrivalType?.replace("_", " ") || "Appointment"}
                      </span>
                    </td>
                    <td>
                      {entry.status === "waiting" ? (
                        <span className="badge warn">Lobby Waiting</span>
                      ) : entry.status === "in_consultation" ? (
                        <span className="badge info">In Cabinet</span>
                      ) : (
                        <span className="badge bg-purple-50 text-purple-700 border-purple-100">Testing Rooms</span>
                      )}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        {entry.status === "waiting" && (
                          <button
                            onClick={() => handleUpdateQueueStatus(entry.id, "in_consultation")}
                            className="py-1 px-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-lg transition-all cursor-pointer border-none"
                            type="button"
                          >
                            Call to Cabin
                          </button>
                        )}
                        {entry.status === "in_consultation" && (
                          <button
                            onClick={() => handleUpdateQueueStatus(entry.id, "testing")}
                            className="py-1 px-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-black rounded-lg transition-all cursor-pointer border-none"
                            type="button"
                          >
                            Start Testing
                          </button>
                        )}
                        {(entry.status === "in_consultation" || entry.status === "testing") && (
                          <button
                            onClick={() => handleUpdateQueueStatus(entry.id, "billing")}
                            className="py-1 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-lg transition-all cursor-pointer border-none"
                            type="button"
                          >
                            Refer to Billing
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </DataTable>
          </SectionCard>
        </div>

        {/* Clinical Checklist Panel */}
        <div>
          <SectionCard title="Cabin Calibration & Compliance" subtitle="Review rooms audit guidelines daily.">
            <div className="stack gap-4 py-2">
              <label className="flex items-start gap-3 p-3.5 bg-slate-50 rounded-xl cursor-pointer select-none border border-slate-100">
                <input type="checkbox" defaultChecked className="mt-1 w-4 h-4 text-blue-600" />
                <div>
                  <h5 className="text-xs font-bold text-slate-800">Diagnostic Audiometer Calibrated</h5>
                  <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Checked reference frequencies and bone conduction output.</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3.5 bg-slate-50 rounded-xl cursor-pointer select-none border border-slate-100">
                <input type="checkbox" defaultChecked className="mt-1 w-4 h-4 text-blue-600" />
                <div>
                  <h5 className="text-xs font-bold text-slate-800">Sound-proof Cabin Noise Check</h5>
                  <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Internal ambient decibels verified below 30dB benchmark.</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3.5 bg-slate-50 rounded-xl cursor-pointer select-none border border-slate-100">
                <input type="checkbox" className="mt-1 w-4 h-4 text-blue-600" />
                <div>
                  <h5 className="text-xs font-bold text-slate-800">Bilateral Aid Trial Inventory</h5>
                  <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Verify active demo hearing aid reserves (BTE, RIC, IIC) are charged.</p>
                </div>
              </label>
            </div>
          </SectionCard>
        </div>
      </div>
    </section>
  );
}
