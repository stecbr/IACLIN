import ClinicalMapPage from '@/components/clinical-map/ClinicalMapPage';

/**
 * Legacy route. Delegates to the generic ClinicalMapPage forcing the tooth
 * map type so /odontogram always renders the dental chart.
 */
export default function Odontogram() {
  return <ClinicalMapPage forceMapType="tooth" />;
}