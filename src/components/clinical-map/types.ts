import type { MapType } from './mapRegistry';

export interface ClinicalMapEntry {
  id: string;
  patient_id: string;
  clinic_id: string | null;
  dentist_id: string | null;
  appointment_id: string | null;
  map_type: MapType;
  region_code: string;
  condition: string;
  severity: string | null;
  notes: string | null;
  payload: any;
  created_at: string;
  updated_at: string;
}

export interface ClinicalMapProps {
  patientId: string;
  entries: ClinicalMapEntry[];
  onRegionClick: (regionCode: string) => void;
  selectedRegion: string | null;
}
