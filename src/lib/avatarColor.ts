// Stable color picker per user_id, used to color doctor avatars on agenda cards.
const PALETTE = [
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#F97316', // orange
  '#10B981', // emerald
  '#EC4899', // pink
  '#F59E0B', // amber
  '#06B6D4', // cyan
  '#EF4444', // red
];

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function getAvatarColor(userId: string | null | undefined): string {
  if (!userId) return PALETTE[0];
  return PALETTE[hashString(userId) % PALETTE.length];
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}