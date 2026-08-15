import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}



const initCenter = {
  //indonesia 0.7893° S, 113.9213° E lat long
  lat: -0.7893,
  lng: 113.9213,
};
/**
 * Midpoint of one axis, in a single pass.
 *
 * Deliberately **no `Math.min(...values)`**. Spreading an array into a call
 * places one argument on the stack per element, so it stops working somewhere
 * around a hundred thousand of them — and that is a size this app reaches: the
 * Cek Tumpang Tindih page flattens every kawasan's every ring into one array to
 * frame the map, and a kawasan traced from an SK runs to tens of thousands of
 * vertices on its own. It threw `Maximum call stack size exceeded` and took the
 * whole page with it. A loop has no such ceiling and allocates nothing.
 *
 * Non-finite values are skipped rather than poisoning the result: one bad
 * coordinate in an imported boundary would otherwise make the centre `NaN` and
 * blank the map.
 */
function getMiddle(prop: "lat" | "lng", markers: google.maps.LatLngLiteral[]) {
  let min = Infinity;
  let max = -Infinity;
  for (const marker of markers) {
    const value = marker?.[prop];
    if (!Number.isFinite(value)) continue;
    if (value < min) min = value;
    if (value > max) max = value;
  }
  // Every value was unusable — fall back rather than returning NaN.
  if (min === Infinity) return initCenter[prop];

  if (prop === "lng" && max - min > 180) {
    // Spanning the antimeridian: shift the western points east and re-measure,
    // again in one pass over the source rather than building a second array.
    const threshold = max - 180;
    let shiftedMin = Infinity;
    let shiftedMax = -Infinity;
    for (const marker of markers) {
      const raw = marker?.[prop];
      if (!Number.isFinite(raw)) continue;
      const value = raw < threshold ? raw + 360 : raw;
      if (value < shiftedMin) shiftedMin = value;
      if (value > shiftedMax) shiftedMax = value;
    }
    min = shiftedMin;
    max = shiftedMax;
  }

  let result = (min + max) / 2;
  if (prop === "lng" && result > 180) {
    result -= 360;
  }
  return result;
}
export function findCenter(markers: google.maps.LatLngLiteral[]) {
  if (markers.length == 0) {
    return initCenter;
  }
  return {
    lat: getMiddle("lat", markers),
    lng: getMiddle("lng", markers),
  };
}