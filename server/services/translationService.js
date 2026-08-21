/**
 * =========================================================
 * translationService.js
 * =========================================================
 *
 * Translation service for the multilingual chat app.
 *
 * Provider:
 * @vitalets/google-translate-api
 *
 * Supported:
 * English -> en
 * Hausa   -> ha
 * French  -> fr
 * Arabic  -> ar
 *
 * IMPORTANT:
 * translateText() always returns a STRING.
 *
 * If translation fails, the original message is returned
 * so that translation problems never break chat.
 * =========================================================
 */

const {
  translate,
} = require("@vitalets/google-translate-api");

// =========================================================
// LANGUAGE CODES
// =========================================================

const LANGUAGE_CODES = {
  english: "en",
  hausa: "ha",
  french: "fr",
  arabic: "ar",

  en: "en",
  ha: "ha",
  fr: "fr",
  ar: "ar",
};

// =========================================================
// LANGUAGE NAMES
// =========================================================

const LANGUAGE_NAMES = {
  en: "English",
  ha: "Hausa",
  fr: "French",
  ar: "Arabic",
};

// =========================================================
// NORMALIZE LANGUAGE CODE
// =========================================================

function normalizeLanguageCode(language) {
  if (
    language === null ||
    language === undefined
  ) {
    return null;
  }

  const key = String(language)
    .trim()
    .toLowerCase();

  const code = LANGUAGE_CODES[key];

  if (!code) {
    throw new Error(
      `Unsupported language "${language}". Supported languages: English, Hausa, French, Arabic.`
    );
  }

  return code;
}

// =========================================================
// GET LANGUAGE NAME
// =========================================================

function getLanguageName(language) {
  const code =
    normalizeLanguageCode(language);

  return LANGUAGE_NAMES[code];
}

// =========================================================
// CHECK SUPPORTED LANGUAGE
// =========================================================

function isSupportedLanguage(language) {
  try {
    normalizeLanguageCode(language);
    return true;
  } catch {
    return false;
  }
}

// =========================================================
// TRANSLATE TEXT
// =========================================================

async function translateText(
  text,
  sourceLang,
  targetLang
) {
  // -------------------------------------------------------
  // Validate text
  // -------------------------------------------------------

  if (typeof text !== "string") {
    return text;
  }

  const originalText = text.trim();

  if (!originalText) {
    return text;
  }

  // -------------------------------------------------------
  // Normalize languages
  // -------------------------------------------------------

  let source;
  let target;

  try {
    source =
      normalizeLanguageCode(sourceLang);

    target =
      normalizeLanguageCode(targetLang);
  } catch (error) {
    console.error(
      "[TRANSLATION] Language error:",
      error.message
    );

    return originalText;
  }

  // -------------------------------------------------------
  // No translation required
  // -------------------------------------------------------

  if (source === target) {
    return originalText;
  }

  console.log(
    `[TRANSLATION] ${source} -> ${target}: "${originalText}"`
  );

  // -------------------------------------------------------
  // Translate
  // -------------------------------------------------------

  try {
    const result = await translate(
      originalText,
      {
        from: source,
        to: target,
      }
    );

    const translatedText =
      result?.text;

    // -----------------------------------------------------
    // Validate response
    // -----------------------------------------------------

    if (
      typeof translatedText !== "string" ||
      !translatedText.trim()
    ) {
      console.error(
        "[TRANSLATION] Invalid translation response."
      );

      return originalText;
    }

    const finalText =
      translatedText.trim();

    console.log(
      `[TRANSLATION] Success ${source} -> ${target}: "${finalText}"`
    );

    return finalText;
  } catch (error) {
    console.error(
      `[TRANSLATION] Failed ${source} -> ${target}:`,
      error.message
    );

    // -----------------------------------------------------
    // IMPORTANT
    //
    // Never allow translation failure to break chat.
    // -----------------------------------------------------

    return originalText;
  }
}

// =========================================================
// TRANSLATE TO MULTIPLE LANGUAGES
// =========================================================

async function translateToMultipleLanguages(
  text,
  sourceLang,
  targetLangs
) {
  if (
    !Array.isArray(targetLangs) ||
    targetLangs.length === 0
  ) {
    return {};
  }

  let source;

  try {
    source =
      normalizeLanguageCode(sourceLang);
  } catch (error) {
    console.error(
      "[TRANSLATION] Source language error:",
      error.message
    );

    return {};
  }

  // -------------------------------------------------------
  // Normalize + remove duplicates
  // -------------------------------------------------------

  const uniqueTargets = [
    ...new Set(
      targetLangs
        .map((language) => {
          try {
            return normalizeLanguageCode(
              language
            );
          } catch {
            return null;
          }
        })
        .filter(Boolean)
    ),
  ];

  // -------------------------------------------------------
  // Translate in parallel
  // -------------------------------------------------------

  const results =
    await Promise.all(
      uniqueTargets.map(
        async (target) => {
          const translated =
            await translateText(
              text,
              source,
              target
            );

          return [
            target,
            translated,
          ];
        }
      )
    );

  return Object.fromEntries(
    results
  );
}

// =========================================================
// EXPORTS
// =========================================================

module.exports = {
  LANGUAGE_CODES,
  LANGUAGE_NAMES,
  normalizeLanguageCode,
  getLanguageName,
  isSupportedLanguage,
  translateText,
  translateToMultipleLanguages,
};