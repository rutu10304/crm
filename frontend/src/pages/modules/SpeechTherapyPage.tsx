import { useState } from "react";
import { DataTable } from "../../components/erp/DataTable";
import { PageHeader } from "../../components/erp/PageHeader";
import { SectionCard } from "../../components/erp/SectionCard";
import { PatientNameButton } from "../../components/patient/PatientNameButton";

type TherapyIssue =
  | "language_disorder"
  | "speech_delay"
  | "articulation_issue"
  | "stammering";

type TherapyStage =
  | "intake"
  | "assessment"
  | "planning"
  | "scheduled"
  | "in_session"
  | "home_practice"
  | "review"
  | "closed";

const stageLabel: Record<TherapyStage, string> = {
  intake: "Intake",
  assessment: "Assessment",
  planning: "Planning",
  scheduled: "Session Scheduled",
  in_session: "Session Execution",
  home_practice: "Home Practice",
  review: "Review and Reassessment",
  closed: "Case Closure",
};

interface TherapyCase {
  id: string;
  patientName: string;
  issueType: TherapyIssue;
  stage: TherapyStage;
  hearingCoordination: boolean;
  missedSession: boolean;
}

const initialCases: TherapyCase[] = [
  {
    id: "SP-001",
    patientName: "Aarav Bansal",
    issueType: "speech_delay",
    stage: "scheduled",
    hearingCoordination: true,
    missedSession: false,
  },
  {
    id: "SP-002",
    patientName: "Mahi Gupta",
    issueType: "stammering",
    stage: "review",
    hearingCoordination: false,
    missedSession: true,
  },
];

export function SpeechTherapyPage() {
  const [cases, setCases] = useState(initialCases);
  const [patientName, setPatientName] = useState("");
  const [issueType, setIssueType] = useState<TherapyIssue>("language_disorder");
  const [stage, setStage] = useState<TherapyStage>("intake");
  const [hearingCoordination, setHearingCoordination] = useState(false);
  const [missedSession, setMissedSession] = useState(false);

  function addCase(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!patientName.trim()) return;
    setCases((prev) => [
      ...prev,
      {
        id: `SP-${String(prev.length + 1).padStart(3, "0")}`,
        patientName: patientName.trim(),
        issueType,
        stage,
        hearingCoordination,
        missedSession,
      },
    ]);
    setPatientName("");
    setHearingCoordination(false);
    setMissedSession(false);
  }

  return (
    <section className="stack">
      <PageHeader
        title="Speech Therapy Process Workflow"
        subtitle="Intake -> assessment -> planning -> sessions -> home practice -> review -> closure."
      />

      <form className="card glass stack compact" onSubmit={addCase}>
        <h2>Create / Update Therapy Case</h2>
        <div className="grid two">
          <input
            className="input"
            placeholder="Patient name"
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
          />
          <select
            className="input"
            value={issueType}
            onChange={(e) => setIssueType(e.target.value as TherapyIssue)}
          >
            <option value="language_disorder">Language disorder</option>
            <option value="speech_delay">Speech delay</option>
            <option value="articulation_issue">Articulation issue</option>
            <option value="stammering">Stammering</option>
          </select>
          <select
            className="input"
            value={stage}
            onChange={(e) => setStage(e.target.value as TherapyStage)}
          >
            {Object.keys(stageLabel).map((entry) => (
              <option key={entry} value={entry}>
                {stageLabel[entry as TherapyStage]}
              </option>
            ))}
          </select>
          <label className="inline">
            <input
              type="checkbox"
              checked={hearingCoordination}
              onChange={(e) => setHearingCoordination(e.target.checked)}
            />
            Hearing issue involved (coordinate with audiologist)
          </label>
          <label className="inline">
            <input
              type="checkbox"
              checked={missedSession}
              onChange={(e) => setMissedSession(e.target.checked)}
            />
            Missed session (reschedule required)
          </label>
        </div>
        <textarea
          className="input textarea"
          placeholder="Session notes: activities, response, improvement, home practice guidance..."
        />
        <button className="button primary" type="submit">
          Save Therapy Case
        </button>
      </form>

      <SectionCard title="Speech Therapy Case Register">
        <DataTable
          headers={["Case ID", "Patient", "Issue Type", "Stage", "Coordination", "Missed Session"]}
          hasRows={cases.length > 0}
        >
          {cases.map((item) => (
            <tr key={item.id}>
              <td>{item.id}</td>
              <td><PatientNameButton patient={item} /></td>
              <td>{item.issueType.replaceAll("_", " ")}</td>
              <td><span className="badge info">{stageLabel[item.stage]}</span></td>
              <td>{item.hearingCoordination ? "Yes" : "No"}</td>
              <td>{item.missedSession ? "Reschedule" : "No"}</td>
            </tr>
          ))}
        </DataTable>
      </SectionCard>
    </section>
  );
}
