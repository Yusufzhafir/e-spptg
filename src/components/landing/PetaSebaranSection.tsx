'use client';

import { useEffect, useRef, useState } from 'react';
import { APIProvider, Map as PetaGoogle, useMap } from '@vis.gl/react-google-maps';
import { ChevronUp, Map, MapPin } from 'lucide-react';
import { Reveal } from '../Reveal';
import { formatAngka, formatHektar, type LandingPolygon } from '@/lib/landing-stats';

/**
 * Public map of where registered SPPTG parcels are.
 *
 * Clicking a parcel opens an info window with **four facts about the land and
 * none about the person**: desa/kecamatan, area, land use, and the year of
 * pengajuan — a year rather than the full date, since a precise filing date
 * plus a location narrows a parcel down to one household. The polygons carry no
 * owner, NIK, address or submission id at all (`getRegisteredPolygons`), so
 * there is nothing further to reveal even to someone reading the page source.
 *
 * Green (`#22c55e`) is not decoration: it is the same colour `ReadOnlyMap` gives
 * `SPPTG terdaftar` inside the app, and this map shows exactly that set.
 *
 * The map is **not** loaded until the visitor asks for it. Google Maps JS plus
 * every parcel outline is the heaviest thing on this page, and on a public page
 * that is not just a performance question — every load of the API is billable,
 * and a page anyone (including crawlers) can open would otherwise bill on every
 * single hit.
 */

/**
 * The same opening view as "Peta Sebaran Lahan" on the dashboard — the defaults
 * `MapView`/`ReadOnlyMap` carry — so the public map and the internal one frame
 * Kutai Timur identically.
 *
 * A fixed camera rather than `fitBounds`, and that is also what keeps the view
 * stable: fitting to the data lets a single mis-digitised boundary (a swapped or
 * mis-scaled coordinate pair, which does happen) pull the frame out to a view of
 * the planet. Every parcel is still drawn; none of them aims the camera.
 */
const PUSAT_KUTIM = { lat: 0.6164979547396072, lng: 117.32086147991855 };
const ZOOM_KUTIM = 13;

/** The `SPPTG terdaftar` green from `ReadOnlyMap.getPolygonColor`. */
const HIJAU_TERDAFTAR = '#22c55e';

/**
 * Hoisted out of the render. A fresh object literal here is a new prop identity
 * on every render, which is one more reason the map re-applies its options —
 * and re-applying options mid-drag is what makes the controls blink.
 */
const GAYA_PETA = { width: '100%', height: '100%' } as const;

/** Escapes text before it goes into the info window's HTML. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Info window markup.
 *
 * Built as an escaped HTML string because `google.maps.InfoWindow` renders its
 * own DOM outside React's tree — mounting a component into it would need a
 * second React root per click. Every interpolation goes through `esc`, so a desa
 * name containing `<` cannot become markup.
 */
function isiInfoWindow(bidang: LandingPolygon): string {
  const baris = (label: string, nilai: string) =>
    `<div style="display:flex;gap:10px;justify-content:space-between;padding:3px 0"><span style="color:#6b7280">${esc(label)}</span><span style="font-weight:600;color:#111827;text-align:right">${esc(nilai)}</span></div>`;

  const wilayah = [bidang.desa, bidang.kecamatan ? `Kec. ${bidang.kecamatan}` : null]
    .filter(Boolean)
    .join(', ');

  return `<div style="font-family:inherit;font-size:12.5px;line-height:1.45;min-width:230px;padding:2px 2px 4px">
    <div style="font-weight:700;color:#111827;font-size:13.5px">${esc(wilayah || 'Bidang SPPTG terdaftar')}</div>
    <div style="margin-top:2px;display:inline-block;border-radius:999px;background:#dcfce7;color:#15803d;padding:1px 8px;font-size:11px;font-weight:600">SPPTG terdaftar</div>
    <div style="margin-top:8px;border-top:1px solid #e5e7eb;padding-top:6px">
      ${baris('Luas bidang', `${formatAngka(bidang.luasM2)} m²`)}
      ${baris('Setara', `${formatHektar(bidang.luasM2)} ha`)}
      ${baris('Penggunaan lahan', bidang.penggunaanLahan || 'Tidak dicatat')}
      ${baris('Tahun pengajuan', bidang.tahun ? String(bidang.tahun) : 'Tidak dicatat')}
    </div>
  </div>`;
}

function Bidang({ polygons }: { polygons: LandingPolygon[] }) {
  const map = useMap();
  const infoRef = useRef<google.maps.InfoWindow | null>(null);

  useEffect(() => {
    if (!map || typeof google === 'undefined') return;

    const info = new google.maps.InfoWindow();
    infoRef.current = info;

    /**
     * True while the visitor is panning.
     *
     * This is what stops the Map/Satellite switch flickering during a drag. As
     * the map moves under a held cursor, every parcel that slides past fires
     * `mouseover` then `mouseout`, and each handler below calls `setOptions` —
     * dozens of overlay redraws per second, each one repainting the map's
     * controls with it. The hover highlight is worth keeping when the map is
     * still; it is worth nothing at all mid-drag.
     */
    let menggeser = false;
    const mulaiGeser = map.addListener('dragstart', () => {
      menggeser = true;
    });
    const selesaiGeser = map.addListener('dragend', () => {
      menggeser = false;
    });

    const shapes = polygons.map((bidang) => {
      const paths = bidang.ring.map(([lng, lat]) => ({ lat, lng }));

      const shape = new google.maps.Polygon({
        paths,
        map,
        strokeColor: HIJAU_TERDAFTAR,
        strokeOpacity: 1,
        strokeWeight: 2,
        fillColor: HIJAU_TERDAFTAR,
        fillOpacity: 0.35,
        clickable: true,
      });

      shape.addListener('click', (event: google.maps.PolyMouseEvent) => {
        info.setContent(isiInfoWindow(bidang));
        // Anchored where the click landed rather than at a centroid, so the
        // bubble opens beside the parcel the visitor actually pointed at.
        info.setPosition(event.latLng ?? paths[0]);
        info.open({ map });
      });

      // The highlight is the only affordance a polygon has that it is clickable
      // at all — but only while the map is standing still (see `menggeser`).
      shape.addListener('mouseover', () => {
        if (!menggeser) shape.setOptions({ fillOpacity: 0.55 });
      });
      shape.addListener('mouseout', () => {
        if (!menggeser) shape.setOptions({ fillOpacity: 0.35 });
      });

      return shape;
    });

    return () => {
      info.close();
      infoRef.current = null;
      mulaiGeser.remove();
      selesaiGeser.remove();
      for (const shape of shapes) {
        google.maps.event.clearInstanceListeners(shape);
        shape.setMap(null);
      }
    };
  }, [map, polygons]);

  return null;
}


export function PetaSebaranSection({
  polygons,
  jumlahBidang,
}: {
  polygons: LandingPolygon[];
  jumlahBidang: number;
}) {
  // The map is **not** loaded until this is clicked. Google Maps JS plus every
  // parcel outline is by far the heaviest thing on this page, and a visitor who
  // came to read about SPPTG should not pay for a map they never look at — nor
  // should the office pay for the billable API load.
  const [tampilkan, setTampilkan] = useState(false);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const adaBidang = polygons.length > 0;
  const siap = adaBidang && Boolean(apiKey);

  return (
    <section className="bg-white">
      <div className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 sm:pb-20 lg:px-8">
        <Reveal className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 font-semibold text-gray-900">
              <MapPin className="h-4 w-4 text-emerald-600" />
              Sebaran bidang SPPTG terdaftar
            </h3>

            {tampilkan ? (
              <button
                type="button"
                onClick={() => setTampilkan(false)}
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
              >
                <ChevronUp className="h-3.5 w-3.5" />
                Sembunyikan Peta
              </button>
            ) : (
              <p className="text-xs text-gray-500">
                {formatAngka(jumlahBidang)} bidang terdaftar
              </p>
            )}
          </div>

          {tampilkan && siap ? (
            <div className="relative mt-4 h-[24rem] overflow-hidden rounded-xl border border-gray-200 bg-gray-50 sm:h-[30rem]">
              <APIProvider apiKey={apiKey!}>
                <PetaGoogle
                  defaultCenter={PUSAT_KUTIM}
                  defaultZoom={ZOOM_KUTIM}
                  // No `mapTypeId` prop: it is a *controlled* option, so the
                  // library would push it back on every options pass and undo
                  // the visitor's switch to Satellite.
                  // No `mapId` either: a cloud-styled map hides the
                  // Map/Satellite switch entirely, and that switch is the point
                  // of these controls.
                  style={GAYA_PETA}
                  gestureHandling="cooperative"
                  mapTypeControl
                  zoomControl
                  streetViewControl
                  fullscreenControl
                  scaleControl
                >
                  <Bidang polygons={polygons} />
                </PetaGoogle>
              </APIProvider>

              <div className="pointer-events-none absolute bottom-8 left-2 rounded-lg border border-gray-200 bg-white/95 px-2.5 py-2 shadow-sm">
                <p className="text-[11px] font-semibold text-gray-700">Keterangan</p>
                <p className="mt-1 flex items-center gap-2 text-[11px] text-gray-600">
                  <span
                    className="inline-block h-3 w-3 rounded-sm border"
                    style={{
                      borderColor: HIJAU_TERDAFTAR,
                      backgroundColor: `${HIJAU_TERDAFTAR}59`,
                    }}
                  />
                  Bidang SPPTG terdaftar
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-gray-300 bg-gray-50/70 px-6 py-14 text-center">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <Map className="h-7 w-7" />
              </span>
              <p className="mt-5 font-semibold text-gray-900">
                Muat Peta Sebaran Bidang Interaktif
              </p>

              {!adaBidang ? (
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-gray-500">
                  Belum ada bidang terdaftar yang dapat dipetakan.
                </p>
              ) : !apiKey ? (
                // Say what is missing rather than offer a button that cannot work.
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-gray-500">
                  Peta tidak dapat dimuat — Google Maps API key belum diatur.
                </p>
              ) : (
                <>
                  <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-gray-500">
                    Peta memuat {formatAngka(jumlahBidang)} batas bidang SPPTG
                    terdaftar se-Kabupaten Kutai Timur. Klik tombol di bawah
                    untuk memuat data spasial saat Anda membutuhkannya.
                  </p>
                  <button
                    type="button"
                    onClick={() => setTampilkan(true)}
                    className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-emerald-700 hover:shadow-md focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:outline-none"
                  >
                    <Map className="h-4 w-4" />
                    Muat &amp; Tampilkan Peta
                  </button>
                </>
              )}
            </div>
          )}
        </Reveal>
      </div>
    </section>
  );
}
