/**
 * "lat,lng" location values. The events API treats a location of this shape as a point and
 * filters by `distanceKm` around it (api-contracts.md §2.3), which powers "Use current location".
 */
const COORDS = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/

export function isCoords(value: string | null | undefined): boolean {
  return !!value && COORDS.test(value)
}

export function parseCoords(value: string | null | undefined): { lat: number; lng: number } | null {
  const m = value ? COORDS.exec(value) : null
  if (!m) return null
  const lat = Number(m[1])
  const lng = Number(m[2])
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null
}

/** 4 decimals ≈ 11 m: precise enough for "events near me", without sharing an exact address. */
export function formatCoords(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)))
}
