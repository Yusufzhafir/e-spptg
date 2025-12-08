import { Loader } from '@googlemaps/js-api-loader';

let loader: Loader | null = null;

export async function loadGoogleMapsAPI(): Promise<typeof google> {
  if (typeof window === 'undefined') {
    throw new Error('Google Maps API can only be loaded on the client side');
  }

  if (loader) {
    return loader.load();
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set');
  }

  loader = new Loader({
    apiKey,
    version: 'weekly',
    libraries: ['ingMapawing', 'geometry'],
  });

  return loader.load();
}

export function getGoogleMapsAPI(): typeof google | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.google || null;
}
