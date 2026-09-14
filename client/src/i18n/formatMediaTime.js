const LOCALES = {
  English: "0123456789",
  Hausa: "0123456789",
  French: "0123456789",
  Arabic: "٠١٢٣٤٥٦٧٨٩",
};

const getDigitMap = (language) => LOCALES[language] || LOCALES.English;

export const formatMediaNumber = (value, language, options = {}) => {
  const digitMap = getDigitMap(language);
  const numericValue = Number(value);
  const [integerPart, decimalPart] = String(numericValue).split(".");
  const minimumIntegerDigits = options.minimumIntegerDigits || 1;
  const paddedInteger = integerPart.padStart(minimumIntegerDigits, "0");
  const asciiNumber = decimalPart
    ? `${paddedInteger}.${decimalPart}`
    : paddedInteger;

  return asciiNumber.replace(/[0-9]/g, (digit) => digitMap[digit]);
};

export const formatMediaTime = (value, language) => {
  if (!Number.isFinite(value) || value < 0) {
    return "0:00";
  }

  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);

  return `${formatMediaNumber(minutes, language)}:${formatMediaNumber(
    seconds,
    language,
    { minimumIntegerDigits: 2 }
  )}`;
};
