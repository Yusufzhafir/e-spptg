/**
 * SPPTG coordinate attachment — the boundary as numbers.
 *
 * Each sheet prints the same points twice: latitude/longitude first, then the
 * UTM easting/northing of those exact rows underneath. Surveyors and the desa
 * work in UTM metres while the system stores WGS84 degrees, and a certificate
 * that only carried degrees left them converting by hand.
 *
 * Sheets are pre-chunked by `coordinateSheets` rather than left to overflow: the
 * footer's page numbers are fixed up front (see `DocumentFooter`), so the layout
 * may never produce a page the pagination did not predict.
 */

import React from 'react';
import { Page, Text, View } from '@react-pdf/renderer';
import { styles } from './styles';
import { DocumentFooter } from './DocumentFooter';
import { toUtmFromLatLon } from '@/lib/utm-conversion';
import { type CoordinateSheet, totalCertificatePages } from './pagination';
import type { PageProps } from './types';

const NO_COLUMN_WIDTH = 60;

function formatCoordinate(value: number): string {
  return Number.isFinite(value) ? value.toFixed(6) : '-';
}

function formatMetres(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : '-';
}

const NoCell: React.FC<{ children: React.ReactNode; header?: boolean }> = ({
  children,
  header = false,
}) => (
  <View
    style={{
      width: NO_COLUMN_WIDTH,
      borderRightWidth: 1,
      borderRightColor: '#000000',
      minHeight: 0,
      paddingVertical: header ? 6 : 5,
      paddingHorizontal: 6,
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <Text
      style={[
        header ? styles.tableHeader : styles.text,
        styles.textCenter,
        { marginBottom: 0 },
      ]}
    >
      {children}
    </Text>
  </View>
);

/** A body/header cell; `last` drops the right border that closes the row. */
const Cell: React.FC<{
  children: React.ReactNode;
  header?: boolean;
  last?: boolean;
}> = ({ children, header = false, last = false }) => (
  <View
    style={[
      last ? styles.tableCellLast : styles.tableCell,
      { minHeight: 0, paddingVertical: header ? 6 : 5 },
    ]}
  >
    <Text
      style={[
        header ? styles.tableHeader : styles.text,
        styles.textCenter,
        { marginBottom: 0 },
      ]}
    >
      {children}
    </Text>
  </View>
);

const GeographicTable: React.FC<{ sheet: CoordinateSheet }> = ({ sheet }) => (
  <View style={[styles.table, { marginTop: 4 }]}>
    <View style={styles.tableRow}>
      <NoCell header>No</NoCell>
      <Cell header>Latitude</Cell>
      <Cell header last>
        Longitude
      </Cell>
    </View>

    {sheet.coordinates.map((coordinate, index) => (
      <View
        key={coordinate.id || `geo-${sheet.startIndex + index}`}
        style={index === sheet.coordinates.length - 1 ? styles.tableRowLast : styles.tableRow}
      >
        <NoCell>{sheet.startIndex + index + 1}</NoCell>
        <Cell>{formatCoordinate(coordinate.latitude)}</Cell>
        <Cell last>{formatCoordinate(coordinate.longitude)}</Cell>
      </View>
    ))}
  </View>
);

const UtmTable: React.FC<{ sheet: CoordinateSheet }> = ({ sheet }) => {
  // Converted at render time from the very rows above, so the two tables can
  // never describe different points.
  const rows = sheet.coordinates.map((coordinate) => ({
    id: coordinate.id,
    utm:
      Number.isFinite(coordinate.latitude) && Number.isFinite(coordinate.longitude)
        ? toUtmFromLatLon(coordinate.latitude, coordinate.longitude)
        : null,
  }));

  return (
    <View style={[styles.table, { marginTop: 4 }]}>
      <View style={styles.tableRow}>
        <NoCell header>No</NoCell>
        <Cell header>Zona</Cell>
        <Cell header>Easting (X)</Cell>
        <Cell header last>
          Northing (Y)
        </Cell>
      </View>

      {rows.map((row, index) => (
        <View
          key={row.id ? `utm-${row.id}` : `utm-${sheet.startIndex + index}`}
          style={index === rows.length - 1 ? styles.tableRowLast : styles.tableRow}
        >
          <NoCell>{sheet.startIndex + index + 1}</NoCell>
          <Cell>{row.utm ? `${row.utm.zone}${row.utm.hemisphere}` : '-'}</Cell>
          <Cell>{row.utm ? formatMetres(row.utm.easting) : '-'}</Cell>
          <Cell last>{row.utm ? formatMetres(row.utm.northing) : '-'}</Cell>
        </View>
      ))}
    </View>
  );
};

/** Heading of one sheet: which bidang, and which slice of it. */
function sheetHeading(sheet: CoordinateSheet): string {
  if (sheet.polygonCount <= 1) return 'Daftar Koordinat Polygon';

  const name = sheet.polygonName?.trim();
  const label = name
    ? `Bidang ${sheet.polygonIndex + 1} dari ${sheet.polygonCount} — ${name}`
    : `Bidang ${sheet.polygonIndex + 1} dari ${sheet.polygonCount}`;
  return `Daftar Koordinat Polygon (${label})`;
}

export const SPPTGCoordinatePage: React.FC<
  PageProps & { sheet: CoordinateSheet; attachmentNumber: number }
> = ({ data, sheet, attachmentNumber }) => (
  <Page size="A4" style={styles.page}>
    <Text style={styles.attachmentLabel}>
      Lampiran {attachmentNumber} - Daftar Koordinat Batas Lahan
    </Text>

    <Text style={[styles.subtitle, { marginTop: 0 }]}>{sheetHeading(sheet)}</Text>

    <Text style={[styles.text, { marginBottom: 2 }]}>Koordinat Geografis (WGS 84)</Text>
    <GeographicTable sheet={sheet} />

    <Text style={[styles.text, { marginTop: 10, marginBottom: 2 }]}>
      Koordinat UTM (WGS 84)
    </Text>
    <UtmTable sheet={sheet} />

    <DocumentFooter page={sheet.page} totalPages={totalCertificatePages(data)} />
  </Page>
);

export default SPPTGCoordinatePage;
