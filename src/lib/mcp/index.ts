import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import listMyAppointmentsTool from "./tools/list-my-appointments";
import searchPatientsTool from "./tools/search-patients";

// The OAuth issuer MUST be the direct Supabase host, built from the project ref
// (see app-mcp-server-authoring). Do NOT derive from SUPABASE_URL.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "iaclin-mcp",
  title: "IACLIN",
  version: "0.1.0",
  instructions:
    "Tools for the IACLIN clinic management platform. Use `whoami` to check the connected user, `list_my_appointments` for their upcoming appointments, and `search_patients` to look up patients they have access to.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoamiTool, listMyAppointmentsTool, searchPatientsTool],
});