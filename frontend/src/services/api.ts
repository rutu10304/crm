import type { UserSession, LoginPayload } from "../types/auth";
import type { TelecallerEntry } from "../data/telecallerStore";
import type { AppointmentRecord, AppointmentSlot } from "../data/appointmentStore";
import type { QueueEntry } from "../data/queueStore";
import type { ReceptionDaySummary } from "../data/receptionStore";
import type { PatientQrData } from "../utils/patientQr";

const API_BASE_URL = "http://localhost:5000/api";

/**
 * API Client for Softone ERP Backend (Flask + MySQL)
 */
export const api = {
  // ==========================================
  // AUTHENTICATION
  // ==========================================
  auth: {
    async login(payload: LoginPayload): Promise<{ ok: boolean; session?: UserSession; error?: string }> {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!response.ok) {
          return { ok: false, error: data.error || "Login failed" };
        }
        return { ok: true, session: data.session };
      } catch (err) {
        return { ok: false, error: "Cannot connect to backend server. Make sure Flask is running." };
      }
    }
  },

  // ==========================================
  // TELECALLER CRM
  // ==========================================
  telecaller: {
    async listEntries(): Promise<TelecallerEntry[]> {
      const response = await fetch(`${API_BASE_URL}/telecaller/entries`);
      if (!response.ok) throw new Error("Failed to fetch telecaller entries");
      return await response.json();
    },

    async saveEntry(entry: TelecallerEntry): Promise<{ ok: boolean; id?: string; error?: string }> {
      try {
        const response = await fetch(`${API_BASE_URL}/telecaller/entries`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(entry),
        });
        const data = await response.json();
        if (!response.ok) return { ok: false, error: data.error };
        return { ok: true, id: data.id };
      } catch (err) {
        return { ok: false, error: "Failed to connect to backend." };
      }
    },

    async updateEntry(id: string, entry: TelecallerEntry): Promise<{ ok: boolean; error?: string }> {
      try {
        const response = await fetch(`${API_BASE_URL}/telecaller/entries/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(entry),
        });
        const data = await response.json();
        if (!response.ok) return { ok: false, error: data.error };
        return { ok: true };
      } catch (err) {
        return { ok: false, error: "Failed to connect to backend." };
      }
    },

    async checkDuplicateMobile(mobileNumber: string): Promise<{ found: boolean; entry?: TelecallerEntry }> {
      const response = await fetch(`${API_BASE_URL}/telecaller/by-mobile/${mobileNumber}`);
      if (!response.ok) throw new Error("Failed to check duplicate mobile");
      return await response.json();
    },

    async findByQrToken(qrToken: string): Promise<{ found: boolean; entry?: TelecallerEntry }> {
      const response = await fetch(`${API_BASE_URL}/telecaller/by-token/${qrToken}`);
      if (!response.ok) throw new Error("Failed to find entry by QR token");
      return await response.json();
    }
  },

  // ==========================================
  // APPOINTMENTS
  // ==========================================
  appointments: {
    async list(): Promise<AppointmentRecord[]> {
      const response = await fetch(`${API_BASE_URL}/appointments`);
      if (!response.ok) throw new Error("Failed to fetch appointments");
      return await response.json();
    },

    async create(payload: Omit<AppointmentRecord, "id" | "createdAt">): Promise<{ ok: boolean; id?: string; reason?: string }> {
      try {
        const response = await fetch(`${API_BASE_URL}/appointments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await response.json();
        return data;
      } catch (err) {
        return { ok: false, reason: "Failed to connect to backend." };
      }
    },

    async updateStatus(id: string, status: AppointmentRecord["status"]): Promise<{ ok: boolean; error?: string }> {
      try {
        const response = await fetch(`${API_BASE_URL}/appointments/${id}/status`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        const data = await response.json();
        if (!response.ok) return { ok: false, error: data.error };
        return { ok: true };
      } catch (err) {
        return { ok: false, error: "Failed to connect to backend." };
      }
    },

    async getAvailableSlots(clinicName: string, date: string): Promise<AppointmentSlot[]> {
      const response = await fetch(
        `${API_BASE_URL}/appointments/slots?clinicName=${encodeURIComponent(clinicName)}&date=${encodeURIComponent(date)}`
      );
      if (!response.ok) throw new Error("Failed to fetch available slots");
      const data = await response.json();
      return data.availableSlots;
    }
  },

  // ==========================================
  // QUEUE FLOW
  // ==========================================
  queue: {
    async list(): Promise<QueueEntry[]> {
      const response = await fetch(`${API_BASE_URL}/queue`);
      if (!response.ok) throw new Error("Failed to fetch queue entries");
      return await response.json();
    },

    async add(entry: Omit<QueueEntry, "id" | "waitingSinceIso">): Promise<{ ok: boolean; id?: string; error?: string }> {
      try {
        const response = await fetch(`${API_BASE_URL}/queue`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(entry),
        });
        const data = await response.json();
        if (!response.ok) return { ok: false, error: data.error };
        return { ok: true, id: data.id };
      } catch (err) {
        return { ok: false, error: "Failed to connect to backend." };
      }
    },

    async updateStatus(id: string, status: QueueEntry["status"]): Promise<{ ok: boolean; error?: string }> {
      try {
        const response = await fetch(`${API_BASE_URL}/queue/${id}/status`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        const data = await response.json();
        if (!response.ok) return { ok: false, error: data.error };
        return { ok: true };
      } catch (err) {
        return { ok: false, error: "Failed to connect to backend." };
      }
    }
  },

  // ==========================================
  // RECEPTION DAY SUMMARY
  // ==========================================
  reception: {
    async getSummary(date: string): Promise<{ found: boolean; summary?: ReceptionDaySummary }> {
      const response = await fetch(`${API_BASE_URL}/reception/summary?date=${encodeURIComponent(date)}`);
      if (!response.ok) throw new Error("Failed to fetch reception summary");
      return await response.json();
    },

    async saveSummary(summary: ReceptionDaySummary): Promise<{ ok: boolean; error?: string }> {
      try {
        const response = await fetch(`${API_BASE_URL}/reception/summary`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(summary),
        });
        const data = await response.json();
        if (!response.ok) return { ok: false, error: data.error };
        return { ok: true };
      } catch (err) {
        return { ok: false, error: "Failed to connect to backend." };
      }
    }
  },

  // ==========================================
  // PUBLIC (no login — for QR scan landing page)
  // ==========================================
  public: {
    async getPatientByToken(
      qrToken: string
    ): Promise<{ found: boolean; patient?: PatientQrData }> {
      const response = await fetch(
        `${API_BASE_URL}/public/patient/${encodeURIComponent(qrToken.trim())}`
      );
      if (!response.ok) throw new Error("Failed to load patient");
      return await response.json();
    },
  },

  // ==========================================
  // CLINIC BRANCHES
  // ==========================================
  branches: {
    async list(): Promise<any[]> {
      const response = await fetch(`${API_BASE_URL}/branches`);
      if (!response.ok) throw new Error("Failed to fetch branches");
      return await response.json();
    }
  }
};
