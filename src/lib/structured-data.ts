import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL, url } from './site';

/**
 * schema.org graph for the landing page.
 *
 * Three linked nodes rather than one blob: the agency that runs the service,
 * the service itself, and the website. That is what lets a search engine show a
 * branded result with the agency attached instead of a bare blue link, and it is
 * the only structured signal available for a site whose real content sits behind
 * a login.
 *
 * Everything here is public-record information about the service. No applicant
 * data, no counts, nothing that is not already printed on the landing page.
 */
export function landingStructuredData() {
  const agencyId = url('/#organization');
  const websiteId = url('/#website');

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'GovernmentOrganization',
        '@id': agencyId,
        name: 'Pemerintah Kabupaten Kutai Timur',
        url: SITE_URL,
        logo: url('/SIPETA_LOGO.png'),
        areaServed: {
          '@type': 'AdministrativeArea',
          name: 'Kabupaten Kutai Timur',
          containedInPlace: {
            '@type': 'AdministrativeArea',
            name: 'Kalimantan Timur, Indonesia',
          },
        },
      },
      {
        '@type': 'WebSite',
        '@id': websiteId,
        url: SITE_URL,
        name: `${SITE_NAME} — ${SITE_TAGLINE}`,
        description: SITE_DESCRIPTION,
        inLanguage: 'id-ID',
        publisher: { '@id': agencyId },
      },
      {
        '@type': 'GovernmentService',
        name: 'Penerbitan SPPTG (Surat Pernyataan Penguasaan Tanah Garapan)',
        alternateName: 'Layanan SPPTG Kutai Timur',
        description: SITE_DESCRIPTION,
        serviceType: 'Administrasi pertanahan',
        url: SITE_URL,
        provider: { '@id': agencyId },
        areaServed: {
          '@type': 'AdministrativeArea',
          name: 'Kabupaten Kutai Timur',
        },
        audience: {
          '@type': 'Audience',
          audienceType: 'Masyarakat dan aparatur desa Kabupaten Kutai Timur',
        },
        availableChannel: {
          '@type': 'ServiceChannel',
          serviceUrl: SITE_URL,
          name: 'Pengajuan daring SIAPTAH',
          availableLanguage: { '@type': 'Language', name: 'Indonesian', alternateName: 'id' },
        },
      },
    ],
  };
}
