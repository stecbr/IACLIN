import { supabase } from '@/integrations/supabase/client';

const BUCKET = 'patient-files';

/**
 * Accepts either a storage path (new format) or a full public URL (legacy
 * records uploaded before the bucket became private) and returns the path
 * inside the bucket.
 */
export function extractStoragePath(fileUrlOrPath: string | null | undefined): string | null {
  if (!fileUrlOrPath) return null;
  const value = fileUrlOrPath.trim();
  if (!value) return null;
  const marker = `/${BUCKET}/`;
  const idx = value.indexOf(marker);
  if (idx >= 0) return value.slice(idx + marker.length).split('?')[0];
  // Assume it's already a path
  return value.split('?')[0];
}

export async function getSignedFileUrl(
  fileUrlOrPath: string,
  options?: { expiresIn?: number; download?: string }
): Promise<string | null> {
  const path = extractStoragePath(fileUrlOrPath);
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, options?.expiresIn ?? 3600, options?.download ? { download: options.download } : undefined);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}