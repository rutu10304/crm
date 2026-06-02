import { useMemo, useState, useEffect } from "react";
import { DataTable } from "../../components/erp/DataTable";
import { PageHeader } from "../../components/erp/PageHeader";
import { PatientNameButton } from "../../components/patient/PatientNameButton";
import { SectionCard } from "../../components/erp/SectionCard";
import {
  listQueueEntries,
  updateQueueStatus,
  type QueueEntry,
} from "../../data/queueStore";
import { useAuth } from "../../auth/AuthContext";
import { api } from "../../services/api";

function waitClass(minutes: number) {
  if (minutes > 15) return "warn";
  if (minutes > 10) return "info";
  return "ok";
}

export function QueueBoardPage() {
  const { session } = useAuth();
  const [items, setItems] = useState<QueueEntry[]>(() => listQueueEntries());

  // Load queue entries from database if online
  useEffect(() => {
    async function loadDbQueue() {
      try {
        const queue = await api.queue.list();
        setItems(queue);
      } catch (err) {
        console.log("[QueueBoard] Backend offline, using local queue.");
      }
    }
    loadDbQueue();
  }, []);

  const visibleItems = useMemo(() => {
    if (!session?.clinicName) return items;
    return items.filter((item) => item.clinicName === session.clinicName);
  }, [items, session?.clinicName]);

  function minutesSince(iso: string): number {
    const then = new Date(iso).getTime();
    const now = Date.now();
    return Math.max(0, Math.round((now - then) / 60000));
  }

  async function moveNext(item: QueueEntry) {
    const nextStatusMap: Record<QueueEntry["status"], QueueEntry["status"]> = {
      waiting: "in_consultation",
      in_consultation: "testing",
      testing: "billing",
      billing: "billing",
    };
    const nextStatus = nextStatusMap[item.status];
    
    try {
      await api.queue.updateStatus(item.id, nextStatus);
      const queue = await api.queue.list();
      setItems(queue);
    } catch (err) {
      console.log("Database offline, moving next locally.");
      const updated = updateQueueStatus(item.id, nextStatus);
      setItems(updated);
    }
  }

  return (
    <section className="stack">
      <PageHeader
        title="Live Queue Board"
        subtitle="Front office and audiology handoffs based on patient visit status."
      />

      <SectionCard title="Clinic Queue">
        <DataTable
          headers={["Token", "Patient", "Status", "Waiting (min)", "Action"]}
          hasRows={visibleItems.length > 0}
          empty="No queue entries for this clinic."
        >
          {visibleItems.map((item) => (
            <tr key={item.id}>
              <td>{item.id}</td>
              <td><PatientNameButton patient={item} /></td>
              <td><span className="badge info">{item.status.replace("_", " ")}</span></td>
              <td>
                <span className={`badge ${waitClass(minutesSince(item.waitingSinceIso))}`}>
                  {minutesSince(item.waitingSinceIso)}
                </span>
              </td>
              <td>
                <button className="button ghost" type="button" onClick={() => moveNext(item)}>
                  Move Next
                </button>
              </td>
            </tr>
          ))}
        </DataTable>
      </SectionCard>
    </section>
  );
}
