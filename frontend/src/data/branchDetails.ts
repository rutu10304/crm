export interface BranchDetails {
  phone: string;
  address: string;
  locationLink: string;
}

export const BRANCHES_MAP: Record<string, BranchDetails> = {
  "delhi gate": {
    phone: "+91 98101 23456",
    address:
      "12, Netaji Subhash Marg, Daryaganj, near Delhi Gate Metro Station, New Delhi, 110002",
    locationLink: "https://maps.google.com/?q=Delhi+Gate+Metro+Station",
  },
  noida: {
    phone: "+91 98188 11223",
    address:
      "C-56, Sector 62, Landmark: Near Fortis Hospital, Noida, Uttar Pradesh, 201301",
    locationLink: "https://maps.google.com/?q=Sector+62+Noida",
  },
  "laxmi nagar": {
    phone: "+91 99100 44556",
    address:
      "A-24, Main Vikas Marg, near Laxmi Nagar Metro Station Gate No. 1, East Delhi, 110092",
    locationLink: "https://maps.google.com/?q=Laxmi+Nagar+East+Delhi",
  },
  ghaziabad: {
    phone: "+91 88002 23344",
    address:
      "SF-14, Second Floor, Opulent Mall, Gandhi Nagar, Grand Trunk Road, Ghaziabad, Uttar Pradesh, 201001",
    locationLink: "https://maps.google.com/?q=Opulent+Mall+Ghaziabad",
  },
};

export function getBranchDetails(clinicName: string): BranchDetails {
  const norm = clinicName.toLowerCase().replace(/\s*clinic/i, "").trim();
  return (
    BRANCHES_MAP[norm] ?? {
      phone: "+91 98101 23456",
      address:
        "12, Netaji Subhash Marg, Daryaganj, near Delhi Gate Metro Station, New Delhi, 110002",
      locationLink: "https://maps.google.com/?q=Delhi+Gate+Metro+Station",
    }
  );
}
