import { useMemo, useState } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import {
  listFollowUpEntries,
  upsertTelecallerEntry,
  type TelecallerEntry,
} from "../../data/telecallerStore";
import { PageHeader } from "../../components/erp/PageHeader";
import { SectionCard } from "../../components/erp/SectionCard";
import { PatientNameButton } from "../../components/patient/PatientNameButton";
import { DataTable } from "../../components/erp/DataTable";
import { useToast } from "../../layout/ToastProvider";

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function FollowUpCalendarPage() {
  const { pushToast } = useToast();
  const [items, setItems] = useState<TelecallerEntry[]>(() => listFollowUpEntries());
  const [selectedDate, setSelectedDate] = useState(toIsoDate(new Date()));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newTime, setNewTime] = useState("");

  const filtered = useMemo(() => {
    if (!selectedDate) return items;
    return items.filter((item) => item.followUpDate === selectedDate);
  }, [items, selectedDate]);

  function reschedule(entry: TelecallerEntry) {
    if (!selectedDate || !newTime) return;

    const updated: TelecallerEntry = {
      ...entry,
      followUpDate: selectedDate,
      followUpTime: newTime,
    };
    upsertTelecallerEntry(updated);
    setItems(listFollowUpEntries());
    setSelectedId(null);
    setNewTime("");
    pushToast("Follow-up rescheduled successfully.", "success");
  }

  function onCalendarChange(value: unknown) {
    if (Array.isArray(value)) {
      const first = value[0];
      if (first instanceof Date) {
        setSelectedDate(toIsoDate(first));
      }
      return;
    }
    if (value instanceof Date) {
      setSelectedDate(toIsoDate(value));
    }
  }

  return (
    <section className="stack">
      <PageHeader
        title="Follow-up Calendar"
        subtitle="Schedule follow-up date and time for missed calls and pending decisions."
      />
      <div className="grid two">
        <SectionCard title="Calendar View" subtitle="Click any date to filter and reschedule follow-ups.">
          <Calendar
            onChange={onCalendarChange}
            value={selectedDate ? new Date(selectedDate) : new Date()}
            className="followup-calendar"
            tileClassName={({ date }) =>
              items.some((entry) => entry.followUpDate === toIsoDate(date))
                ? "calendar-marked"
                : ""
            }
          />
        </SectionCard>

        <SectionCard title="Date Filter">
          <div className="inline">
            <input
              className="input cursor-pointer"
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              onClick={(e) => {
                try {
                  e.currentTarget.showPicker();
                } catch {}
              }}
            />
            <span className="muted">Showing agenda for selected date.</span>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Follow-up Tasks">
        <DataTable
          headers={[
            "Patient",
            "City",
            "Number",
            "Reason",
            "Scheduled",
            "Calendar Action",
          ]}
          hasRows={filtered.length > 0}
          empty="No follow-up tasks for this date filter."
        >
          {filtered.map((item) => (
            <tr key={item.id}>
              <td><PatientNameButton patient={item} /></td>
              <td>{item.city}</td>
              <td>{item.mobileNumber}</td>
              <td>{item.followUpReason}</td>
              <td>{item.followUpDate} {item.followUpTime}</td>
              <td>
                <div className="inline">
                  <button
                    className="button ghost"
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                  >
                    Reschedule
                  </button>
                  {selectedId === item.id ? (
                    <>
                      <input
                        className="input"
                        type="time"
                        value={newTime}
                        onChange={(event) => setNewTime(event.target.value)}
                      />
                      <button
                        className="button primary"
                        type="button"
                        onClick={() => reschedule(item)}
                      >
                        Save
                      </button>
                    </>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      </SectionCard>
    </section>
  );
}
