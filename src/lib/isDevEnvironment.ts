const PROD_LOVABLE_HOSTS = ['dental-bridge-suite.lovable.app'];

export const isDevEnvironment = (): boolean => {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  if (PROD_LOVABLE_HOSTS.includes(h)) return false;
  if (h === 'iaclin.test.ia.br') return false;
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h.endsWith('.lovable.app') ||
    h.includes('lovable.dev')
  );
};