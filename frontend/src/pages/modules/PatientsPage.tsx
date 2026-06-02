import { ChevronRight, Filter, Search, UserRound } from "lucide-react";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { DataTable } from "../../components/erp/DataTable";
import { PageHeader } from "../../components/erp/PageHeader";
import { SectionCard } from "../../components/erp/SectionCard";
import { PatientNameButton } from "../../components/patient/PatientNameButton";

type PatientStatus = "active" | "follow_up" | "trial" | "completed";

interface PatientRecord {
  id: string;
  name: string;
  city: string;
  phone: string;
  status: PatientStatus;
  stage: string;
  lastVisit: string;
}

const statuses: PatientStatus[] = ["active", "follow_up", "trial", "completed"];

const DATASET: PatientRecord[] = Array.from({ length: 84 }, (_, idx) => {
  const status = statuses[idx % statuses.length];
  return {
    id: `PT-${String(idx + 1).padStart(4, "0")}`,
    name: `Patient ${idx + 1}`,
    city: ["Delhi", "Noida", "Ghaziabad", "Faridabad"][idx % 4],
    phone: `98${String(10000000 + idx)}`,
    status,
    stage: ["Lead", "Appointment", "Reception", "Audiology", "Trial", "Billing"][idx % 6],
    lastVisit: `2026-05-${String((idx % 28) + 1).padStart(2, "0")}`,
  };
});

export function PatientsPage() {
  const [query, setQuery] = useState("");
  const [statusTab, setStatusTab] = useState<"all" | PatientStatus>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(null);
  const pageSize = 12;

  const filtered = useMemo(() => {
    return DATASET.filter((item) => {
      const queryMatch = `${item.name} ${item.phone} ${item.city}`
        .toLowerCase()
        .includes(query.toLowerCase());
      const statusMatch = statusTab === "all" ? true : item.status === statusTab;
      return queryMatch && statusMatch;
    });
  }, [query, statusTab]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRecords = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <section className="stack">
      <PageHeader
        title="Patients Workspace"
        subtitle="Large-scale patient directory with search, filters, status tabs, and detail panel."
      />

      <SectionCard title="Patient Controls">
        <div className="inline full-wrap">
          <div className="inline surface-input">
            <Search size={16} />
            <input
              className="input inline-input"
              placeholder="Search name, number, city..."
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <div className="inline status-tabs">
            {["all", ...statuses].map((entry) => (
              <button
                key={entry}
                className={`chip ${statusTab === entry ? "chip-active" : ""}`}
                onClick={() => {
                  setStatusTab(entry as "all" | PatientStatus);
                  setCurrentPage(1);
                }}
                type="button"
              >
                <Filter size={14} />
                {entry.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>
      </SectionCard>

      <div className="workspace-split">
        <SectionCard title={`Patients (${filtered.length})`} subtitle="Quick actions and row-level detail view">
          <DataTable
            headers={["ID", "Patient", "City", "Phone", "Stage", "Status", "Action"]}
            hasRows={pageRecords.length > 0}
            empty="No patient records match current filter."
          >
            {pageRecords.map((item) => (
              <tr key={item.id}>
                <td>{item.id}</td>
                <td>
                  <PatientNameButton
                    patient={{
                      id: item.id,
                      name: item.name,
                      phone: item.phone,
                      city: item.city,
                      status: item.status,
                      stage: item.stage,
                    }}
                  />
                </td>
                <td>{item.city}</td>
                <td>{item.phone}</td>
                <td>{item.stage}</td>
                <td><span className={`badge ${item.status === "completed" ? "ok" : item.status === "trial" ? "info" : "warn"}`}>{item.status.replace("_", " ")}</span></td>
                <td>
                  <button className="button ghost inline" type="button" onClick={() => setSelectedPatient(item)}>
                    Open
                    <ChevronRight size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </DataTable>

          <div className="inline pagination">
            <button className="button ghost" type="button" onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}>
              Previous
            </button>
            <span className="muted">Page {currentPage} of {totalPages}</span>
            <button className="button ghost" type="button" onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}>
              Next
            </button>
          </div>
        </SectionCard>

        <motion.aside
          className="detail-panel card glass"
          initial={{ opacity: 0.65, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.22 }}
        >
          {selectedPatient ? (
            <div className="stack compact">
              <h2 className="inline"><UserRound size={16} /> Patient Detail</h2>
              <p><strong>{selectedPatient.name}</strong></p>
              <p className="muted">{selectedPatient.id}</p>
              <p>Phone: {selectedPatient.phone}</p>
              <p>City: {selectedPatient.city}</p>
              <p>Journey Stage: {selectedPatient.stage}</p>
              <p>Last Visit: {selectedPatient.lastVisit}</p>
              <p>Status: <span className="badge info">{selectedPatient.status}</span></p>
              <div className="inline">
                <button className="button primary" type="button">Book Appointment</button>
                <button className="button ghost" type="button">Open Timeline</button>
              </div>
            </div>
          ) : (
            <div className="stack compact">
              <h2>Detail Panel</h2>
              <p className="muted">Select a patient row to open quick details and actions.</p>
            </div>
          )}
        </motion.aside>
      </div>
    </section>
  );
}
