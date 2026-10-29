/** Returns the normalized 5-digit ZIP, or null if invalid. */
export function parseZip(raw: string | null | undefined): string | null {
  const z = (raw ?? "").trim();
  // Strictly 5 digits. ZIP+4 is rejected: the app only ever sends the 5-digit ZIP.
  // 00000 is not a real ZIP.
  return /^\d{5}$/.test(z) && z !== "00000" ? z : null;
}
