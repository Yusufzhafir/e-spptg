import { SITE_CONTACT, SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL, url } from './site';

/**
 * Drops keys whose value is empty, so an unfilled `SITE_CONTACT` field never
 * reaches the graph as `""`. An empty required property is worse than an absent
 * one — validators flag it, and it advertises a contact channel that is not real.
 */
function compact<T extends object>(obj: T): Partial<T> | undefined {
  const entries = Object.entries(obj).filter(
    ([, value]) => value !== '' && value != null && (!Array.isArray(value) || value.length > 0)
  );
  return entries.length > 0 ? (Object.fromEntries(entries) as Partial<T>) : undefined;
}

/** The organisation's postal address, or undefined while it is unfilled. */
function agencyAddress() {
  const address = compact({
    streetAddress: SITE_CONTACT.streetAddress,
    addressLocality: SITE_CONTACT.addressLocality,
    addressRegion: SITE_CONTACT.addressRegion,
    postalCode: SITE_CONTACT.postalCode,
  });
  // Locality/region are hardcoded, so require a street before claiming an address.
  return SITE_CONTACT.streetAddress && address
    ? { '@type': 'PostalAddress', addressCountry: 'ID', ...address }
    : undefined;
}

/** A reachable support channel, or undefined while none is configured. */
function agencyContactPoint() {
  const contact = compact({
    telephone: SITE_CONTACT.telephone,
    email: SITE_CONTACT.email,
  });
  return contact
    ? {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        availableLanguage: { '@type': 'Language', name: 'Indonesian', alternateName: 'id' },
        ...contact,
      }
    : undefined;
}

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
        // Each is dropped entirely while its SITE_CONTACT source is blank.
        ...(agencyAddress() ? { address: agencyAddress() } : {}),
        ...(agencyContactPoint() ? { contactPoint: agencyContactPoint() } : {}),
        ...(SITE_CONTACT.sameAs.length > 0 ? { sameAs: [...SITE_CONTACT.sameAs] } : {}),
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
