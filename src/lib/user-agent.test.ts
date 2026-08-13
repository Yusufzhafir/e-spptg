import {
  adalahBot,
  browserDari,
  klasifikasiRujukan,
  perangkatDari,
  sistemOperasiDari,
  TIDAK_DIKETAHUI,
} from './user-agent';

const CHROME_WIN =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const EDGE_WIN =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0';
const SAFARI_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const CHROME_ANDROID =
  'Mozilla/5.0 (Linux; Android 13; SM-A536E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1';
const FIREFOX_LINUX =
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0';

describe('browserDari', () => {
  it('picks the derived brand over the Chrome token it also carries', () => {
    expect(browserDari(EDGE_WIN)).toBe('Edge');
    expect(browserDari(CHROME_WIN)).toBe('Chrome');
  });

  it('only calls it Safari when no other engine claimed the string first', () => {
    expect(browserDari(SAFARI_MAC)).toBe('Safari');
    expect(browserDari(CHROME_ANDROID)).toBe('Chrome');
  });

  it('recognises Firefox', () => {
    expect(browserDari(FIREFOX_LINUX)).toBe('Firefox');
  });

  it('says so instead of guessing when nothing matches', () => {
    expect(browserDari('sesuatu-yang-aneh')).toBe(TIDAK_DIKETAHUI);
    expect(browserDari(null)).toBe(TIDAK_DIKETAHUI);
  });
});

describe('sistemOperasiDari', () => {
  it('reads Android before Linux, which every Android UA also claims', () => {
    expect(sistemOperasiDari(CHROME_ANDROID)).toBe('Android');
    expect(sistemOperasiDari(FIREFOX_LINUX)).toBe('Linux');
  });

  it('maps the Windows NT versions people still run', () => {
    expect(sistemOperasiDari(CHROME_WIN)).toBe('Windows 10');
    expect(sistemOperasiDari('Mozilla/5.0 (Windows NT 6.1; Win64; x64)')).toBe('Windows 7');
  });

  it('handles Apple platforms', () => {
    expect(sistemOperasiDari(SAFARI_MAC)).toBe('macOS');
    expect(sistemOperasiDari(SAFARI_IPHONE)).toBe('iOS');
  });
});

describe('perangkatDari', () => {
  it('separates phones, tablets and desktops', () => {
    expect(perangkatDari(SAFARI_IPHONE)).toBe('Ponsel');
    expect(perangkatDari(CHROME_ANDROID)).toBe('Ponsel');
    expect(perangkatDari(CHROME_WIN)).toBe('Desktop');
  });

  it('treats an Android without the Mobile token as a tablet', () => {
    expect(
      perangkatDari(
        'Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
      )
    ).toBe('Tablet');
  });
});

describe('adalahBot', () => {
  it('catches crawlers and preview fetchers', () => {
    expect(adalahBot('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe(true);
    expect(adalahBot('facebookexternalhit/1.1')).toBe(true);
    expect(adalahBot('curl/8.5.0')).toBe(true);
  });

  it('treats a missing user agent as a script, not a person', () => {
    expect(adalahBot(null)).toBe(true);
    expect(adalahBot('')).toBe(true);
  });

  it('lets real browsers through', () => {
    expect(adalahBot(CHROME_WIN)).toBe(false);
    expect(adalahBot(SAFARI_IPHONE)).toBe(false);
  });
});

describe('klasifikasiRujukan', () => {
  it('calls a visit from our own host internal navigation', () => {
    expect(klasifikasiRujukan('https://siaptah.kutaitimurkab.go.id/', 'siaptah.kutaitimurkab.go.id')).toEqual({
      jenis: 'internal',
      host: null,
    });
  });

  it('ignores the www prefix and the port when comparing hosts', () => {
    expect(klasifikasiRujukan('https://www.siaptah.go.id/x', 'siaptah.go.id:3000')).toEqual({
      jenis: 'internal',
      host: null,
    });
  });

  it('records the host of an external referrer', () => {
    expect(klasifikasiRujukan('https://www.google.com/search?q=spptg', 'siaptah.go.id')).toEqual({
      jenis: 'eksternal',
      host: 'google.com',
    });
  });

  it('counts a missing or unparsable referrer as a direct visit', () => {
    expect(klasifikasiRujukan(null, 'siaptah.go.id')).toEqual({ jenis: 'langsung', host: null });
    expect(klasifikasiRujukan('bukan-url', 'siaptah.go.id')).toEqual({
      jenis: 'langsung',
      host: null,
    });
  });
});
