// Whitelist de e-mails com acesso ao "modo desenvolvedor"
// (alternar visões Clínica / Médico / Paciente sem precisar de logins separados)
export const DEV_EMAILS: string[] = [
  'lucasferreiraceara@gmail.com',
  'endrya161624@gmail.com',
];

export function isDevEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return DEV_EMAILS.includes(email.toLowerCase().trim());
}

export type SimulatedRole = 'admin' | 'dentist' | 'patient';
export const SIMULATED_ROLE_STORAGE_KEY = 'iaclin.simulatedRole';