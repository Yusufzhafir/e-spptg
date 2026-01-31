/**
 * Convert numbers to Indonesian words (terbilang)
 * Used for filling PDF forms with number values in words
 */

const ones = [
  '',
  'satu',
  'dua',
  'tiga',
  'empat',
  'lima',
  'enam',
  'tujuh',
  'delapan',
  'sembilan',
];

const tens = [
  '',
  'sepuluh',
  'dua puluh',
  'tiga puluh',
  'empat puluh',
  'lima puluh',
  'enam puluh',
  'tujuh puluh',
  'delapan puluh',
  'sembilan puluh',
];

const hundreds = [
  '',
  'seratus',
  'dua ratus',
  'tiga ratus',
  'empat ratus',
  'lima ratus',
  'enam ratus',
  'tujuh ratus',
  'delapan ratus',
  'sembilan ratus',
];

function convertHundreds(num: number): string {
  if (num === 0) return '';
  if (num < 10) return ones[num];
  if (num < 20) {
    if (num === 11) return 'sebelas';
    return ones[num - 10] + ' belas';
  }
  if (num < 100) {
    const ten = Math.floor(num / 10);
    const one = num % 10;
    return tens[ten] + (one > 0 ? ' ' + ones[one] : '');
  }
  const hundred = Math.floor(num / 100);
  const remainder = num % 100;
  return hundreds[hundred] + (remainder > 0 ? ' ' + convertHundreds(remainder) : '');
}

function convertThousands(num: number): string {
  if (num < 1000) return convertHundreds(num);
  const thousand = Math.floor(num / 1000);
  const remainder = num % 1000;
  
  let thousandWord = '';
  if (thousand === 1) {
    thousandWord = 'seribu';
  } else {
    thousandWord = convertHundreds(thousand) + ' ribu';
  }
  
  return thousandWord + (remainder > 0 ? ' ' + convertHundreds(remainder) : '');
}

function convertMillions(num: number): string {
  if (num < 1000000) return convertThousands(num);
  const million = Math.floor(num / 1000000);
  const remainder = num % 1000000;
  
  const millionWord = convertHundreds(million) + ' juta';
  return millionWord + (remainder > 0 ? ' ' + convertThousands(remainder) : '');
}

/**
 * Convert a number to Indonesian words (terbilang)
 * @param num - The number to convert
 * @returns The number in Indonesian words
 * @example
 * numberToIndonesianWords(1234) // "seribu dua ratus tiga puluh empat"
 * numberToIndonesianWords(50000) // "lima puluh ribu"
 */
export function numberToIndonesianWords(num: number): string {
  if (num === 0) return 'nol';
  if (num < 0) return 'minus ' + numberToIndonesianWords(-num);
  
  // Handle decimal numbers (for area measurements like 1234.56 m²)
  const integerPart = Math.floor(num);
  const decimalPart = num - integerPart;
  
  let result = convertMillions(integerPart);
  
  if (decimalPart > 0) {
    // Convert decimal part (e.g., 0.56 -> "lima puluh enam per seratus")
    const decimalStr = decimalPart.toString().split('.')[1] || '';
    const decimalNum = parseInt(decimalStr.padEnd(2, '0').slice(0, 2), 10);
    if (decimalNum > 0) {
      const denominator = Math.pow(10, decimalStr.length);
      result += ' koma ' + convertHundreds(decimalNum);
    }
  }
  
  return result.trim();
}
