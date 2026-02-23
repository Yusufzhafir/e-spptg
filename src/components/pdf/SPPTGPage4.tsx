/**
 * SPPTG Page 4 Component - Map Attachment
 * 
 * This component renders the fourth page of the SPPTG document containing:
 * - Map attachment header
 * - Owner metadata
 * - Land location map image
 * - Polygon coordinate list
 */

import React from 'react';
import { Page, Text, View, Image } from '@react-pdf/renderer';
import { styles } from './styles';
import { PageProps } from './types';

function formatCoordinate(value: number): string {
  return Number.isFinite(value) ? value.toFixed(6) : '-';
}

export const SPPTGPage4: React.FC<PageProps> = ({ data, config }) => {
  const showMap = config?.includeMap !== false;
  const ownerName = data.namaPemohon?.trim() || '-';
  const coordinates = data.coordinatesGeografis ?? [];
  const noColumnWidth = 80;

  return (
    <Page size="A4" style={styles.page}>
      {/* Map Attachment Header */}
      <Text style={styles.attachmentLabel}>Lampiran 1 - Peta Lahan yang Diajukan</Text>
      <Text style={[styles.text, { marginBottom: 4 }]}>
        Tangkapan peta berikut menampilkan polygon lahan beserta area sekitar.
      </Text>

      {/* Owner metadata */}
      <View style={[styles.section, { marginBottom: 8 }]}>
        <View style={styles.row}>
          <Text style={styles.label}>Pemilik/Pemohon</Text>
          <Text style={styles.colon}>:</Text>
          <Text style={[styles.value, { fontFamily: 'Times-Bold' }]}>{ownerName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Jumlah titik polygon</Text>
          <Text style={styles.colon}>:</Text>
          <Text style={styles.value}>{coordinates.length} titik</Text>
        </View>
      </View>

      {/* Map Image */}
      {showMap && data.mapImageUrl ? (
        <View style={[styles.mapContainer, { marginTop: 4, marginBottom: 10 }]}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image
            src={data.mapImageUrl}
            style={[styles.mapImage, { width: 420, height: 275 }]}
          />
        </View>
      ) : (
        <View
          style={[
            styles.mapContainer,
            {
              borderWidth: 1,
              borderColor: '#ccc',
              paddingHorizontal: 30,
              paddingVertical: 24,
              minHeight: 275,
              marginTop: 4,
              marginBottom: 10,
            },
          ]}
        >
          <Text style={[styles.text, styles.textCenter, { marginTop: 50 }]}>
            [Peta Lokasi Tanah]
          </Text>
          <Text style={[styles.text, styles.textCenter, { fontSize: 9, marginTop: 14 }]}>
            Gambar peta lokasi tanah akan ditampilkan di sini.
          </Text>
          <Text style={[styles.text, styles.textCenter, { fontSize: 8, marginTop: 8, color: '#666' }]}>
            Pastikan koordinat lokasi telah diinput dengan benar pada tahap validasi lapangan.
          </Text>
        </View>
      )}

      {/* Coordinates list */}
      <Text style={[styles.subtitle, { marginTop: 0 }]}>Daftar Koordinat Polygon</Text>
      {coordinates.length > 0 ? (
        <View style={[styles.table, { marginTop: 4 }]}>
          <View style={styles.tableRow}>
            <View
              style={{
                width: noColumnWidth,
                borderRightWidth: 1,
                borderRightColor: '#000000',
                minHeight: 0,
                paddingVertical: 6,
                paddingHorizontal: 6,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={[styles.tableHeader, styles.textCenter, { marginBottom: 0 }]}>No</Text>
            </View>
            <View style={[styles.tableCell, { minHeight: 0, paddingVertical: 6 }]}>
              <Text style={[styles.tableHeader, styles.textCenter, { marginBottom: 0 }]}>Latitude</Text>
            </View>
            <View style={[styles.tableCellLast, { minHeight: 0, paddingVertical: 6 }]}>
              <Text style={[styles.tableHeader, styles.textCenter, { marginBottom: 0 }]}>Longitude</Text>
            </View>
          </View>

          {coordinates.map((coordinate, index) => {
            const isLast = index === coordinates.length - 1;
            return (
              <View key={coordinate.id || `coord-${index + 1}`} style={isLast ? styles.tableRowLast : styles.tableRow}>
                <View
                  style={{
                    width: noColumnWidth,
                    borderRightWidth: 1,
                    borderRightColor: '#000000',
                    minHeight: 0,
                    paddingVertical: 5,
                    paddingHorizontal: 6,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={[styles.text, styles.textCenter, { marginBottom: 0 }]}>{index + 1}</Text>
                </View>
                <View style={[styles.tableCell, { minHeight: 0, paddingVertical: 5 }]}>
                  <Text style={[styles.text, styles.textCenter, { marginBottom: 0 }]}>
                    {formatCoordinate(coordinate.latitude)}
                  </Text>
                </View>
                <View style={[styles.tableCellLast, { minHeight: 0, paddingVertical: 5 }]}>
                  <Text style={[styles.text, styles.textCenter, { marginBottom: 0 }]}>
                    {formatCoordinate(coordinate.longitude)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={[styles.text, { marginTop: 4 }]}>
          Koordinat polygon belum tersedia.
        </Text>
      )}

      {/* Footer */}
      <View style={styles.footer} fixed>
        <Text>
          Surat Pernyataan Penguasaan Tanah Garapan - Halaman 3
        </Text>
      </View>
    </Page>
  );
};

export default SPPTGPage4;
