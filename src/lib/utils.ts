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
function getMiddle(prop: "lat" | "lng", markers: google.maps.LatLngLiteral[]) {
  let values = markers.map((m) => m[prop]);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (prop === "lng" && max - min > 180) {
    values = values.map((val) => (val < max - 180 ? val + 360 : val));
    min = Math.min(...values);
    max = Math.max(...values);
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