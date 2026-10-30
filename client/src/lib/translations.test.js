import assert from 'node:assert/strict';
import { translations, INDIAN_LANGUAGES, detectMissingTranslationKeys, getTranslation } from './translations.js';

console.log('Testing AgriTech Internationalization (i18n) System...');

// 1. Verify all 9 languages are configured
assert.equal(INDIAN_LANGUAGES.length, 9, 'Should support exactly 9 languages');
const supportedCodes = INDIAN_LANGUAGES.map((l) => l.code);
assert.deepEqual(
  supportedCodes,
  ['hi', 'pa', 'mr', 'gu', 'te', 'kn', 'ta', 'bn', 'en'],
  'Supported languages must match expected regional codes'
);

// 2. Verify all 9 languages exist in the translation dictionary
for (const code of supportedCodes) {
  assert.ok(translations[code], `Translation dictionary for ${code} must exist`);
  assert.equal(typeof translations[code], 'object', `Translations for ${code} must be an object`);
}

// 3. Verify 100% key parity and zero missing keys
const parityCheck = detectMissingTranslationKeys('en');
assert.equal(parityCheck.hasMissing, false, 'There must be NO missing translation keys in any language');
assert.ok(parityCheck.totalBaseKeys > 700, `Expected at least 700 translation keys, found ${parityCheck.totalBaseKeys}`);
assert.deepEqual(parityCheck.missingByLang, {}, 'Missing keys by language must be empty');

// 4. Verify getTranslation helper with dynamic interpolation
const emailInterpolation = getTranslation('en', 'nav.unverifiedEmailNotice', { email: 'farmer@example.com' });
assert.ok(
  emailInterpolation.includes('farmer@example.com'),
  'getTranslation must interpolate dynamic values like {email}'
);

const hindiNav = getTranslation('hi', 'nav.overview');
assert.equal(hindiNav, 'अवलोकन', 'Hindi translation for nav.overview must match expected value');

const punjabiAdmin = getTranslation('pa', 'admin.title');
assert.ok(punjabiAdmin && punjabiAdmin !== 'admin.title', 'Punjabi translation for admin.title must be populated');

// 5. Verify fallback behavior on genuinely missing keys
const missingKeyFallback = getTranslation('kn', 'nonexistent.domain.key');
assert.equal(missingKeyFallback, 'nonexistent.domain.key', 'Missing key should cleanly fallback to key path');

console.log(`✔ All i18n tests passed successfully! Total Base Keys: ${parityCheck.totalBaseKeys} across all 9 languages with 100% parity.`);
