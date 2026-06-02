import { getBranchDetails } from "../data/branchDetails";
import type { PatientProfile } from "../types/patient";
import { getPatientQrCodeUrl } from "./patientQr";

export function formatPhoneForWhatsApp(mobile: string): string {
  const digits = mobile.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.startsWith("91") && digits.length >= 12) return digits;
  return digits;
}

export function buildPatientWhatsAppMessage(profile: PatientProfile): string {
  const branch = getBranchDetails(profile.assignedBranch ?? profile.city ?? "Delhi Gate");
  const lines = [
    "📝 *Softone Hearing — Patient Details*",
    "",
    `🎫 *Token:* ${profile.qrToken ?? "—"}`,
    `👤 *Patient:* ${profile.patientName}`,
    `📞 *Mobile:* ${profile.mobileNumber}`,
    profile.city ? `📍 *City:* ${profile.city}` : null,
    profile.assignedBranch ? `🏢 *Clinic:* ${profile.assignedBranch}` : null,
    profile.status ? `📊 *Status:* ${String(profile.status).replace(/_/g, " ")}` : null,
    profile.nextFollowUpDate
      ? `📅 *Appointment:* ${profile.nextFollowUpDate}${profile.nextFollowUpTime ? ` (${profile.nextFollowUpTime})` : ""}`
      : null,
    profile.notes ? `\n💬 *Notes:* ${profile.notes}` : null,
    "",
    "🏢 *Clinic Address:*",
    branch.address,
    `📞 *Clinic Phone:* ${branch.phone}`,
    `🗺 *Location:* ${branch.locationLink}`,
    "",
    profile.qrToken
      ? `🔗 *View full details:* ${getPatientQrCodeUrl(profile.qrToken)}`
      : null,
    "",
    "Scan the QR code to open this page on your phone.",
  ];
  return lines.filter(Boolean).join("\n");
}

export async function sharePatientQrToWhatsApp(options: {
  canvasId: string;
  mobileNumber: string;
  message: string;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}): Promise<void> {
  const { canvasId, mobileNumber, message, onSuccess, onError } = options;
  const phone = formatPhoneForWhatsApp(mobileNumber);
  const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

  const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
  if (!canvas) {
    window.open(waUrl, "_blank", "noopener,noreferrer");
    onSuccess("Opening WhatsApp with patient details…");
    return;
  }

  try {
    await new Promise<void>((resolve, reject) => {
      canvas.toBlob(async (blob) => {
        if (!blob) {
          window.open(waUrl, "_blank", "noopener,noreferrer");
          onSuccess("Opening WhatsApp with patient details…");
          resolve();
          return;
        }

        const file = new File([blob], "softone-patient-qr.png", { type: "image/png" });

        try {
          if (navigator.canShare?.({ files: [file] })) {
            await navigator.share({
              title: "Softone Patient QR",
              text: message,
              files: [file],
            });
            onSuccess("Shared to WhatsApp with QR image.");
            resolve();
            return;
          }
        } catch {
          /* fall through */
        }

        try {
          await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
          window.open(waUrl, "_blank", "noopener,noreferrer");
          onSuccess("QR copied — paste image in WhatsApp chat if needed.");
          resolve();
        } catch {
          window.open(waUrl, "_blank", "noopener,noreferrer");
          onSuccess("Opening WhatsApp — attach QR from the screen if needed.");
          resolve();
        }
      }, "image/png");
    });
  } catch {
    onError("Could not share QR. Try Download, then send manually.");
    window.open(waUrl, "_blank", "noopener,noreferrer");
  }
}
