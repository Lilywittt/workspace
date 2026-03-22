const { asStringArray, compactText } = require('./utils');

const DEFAULT_LANE_TENDENCIES = {
  selfie: {
    vibeEn: 'slightly sweeter and more face-near, while still ordinary and believable',
    silhouetteTendenciesEn: [
      'keep the upper-body read clean and youthful',
      'allow a small collar, neckline, or cardigan detail that frames the face naturally'
    ],
    accessoryTendenciesEn: [
      'one tiny accent near the face is enough'
    ]
  },
  life_record: {
    vibeEn: 'ordinary lived-in charm led by action and environment',
    silhouetteTendenciesEn: [
      'the outfit should read naturally from posture and movement',
      'sleeves, hems, socks, or a light outer layer may carry the visual trace'
    ],
    accessoryTendenciesEn: [
      'bags, cuffs, and small practical carry items may be visible when the moment supports them'
    ]
  }
};

function normalizeLaneTendency(raw = {}, defaults = {}) {
  return {
    vibeEn: compactText(raw.vibeEn || defaults.vibeEn || ''),
    silhouetteTendenciesEn: asStringArray(
      raw.silhouetteTendenciesEn || defaults.silhouetteTendenciesEn || [],
      6
    ),
    accessoryTendenciesEn: asStringArray(
      raw.accessoryTendenciesEn || defaults.accessoryTendenciesEn || [],
      6
    )
  };
}

function normalizeClothingPolicy(rawPolicy = {}) {
  const laneTendencies = rawPolicy.laneTendencies || {};

  return {
    bodyReadAnchorsEn: asStringArray(rawPolicy.bodyReadAnchorsEn || [
      'petite early-teen proportions',
      'soft youthful body line',
      'light, unforced posture'
    ], 6),
    presenceReadAnchorsEn: asStringArray(rawPolicy.presenceReadAnchorsEn || [
      'quiet observant presence',
      'fresh everyday innocence',
      'slightly shy but gently playful energy'
    ], 6),
    everydayMoodEn: compactText(
      rawPolicy.everydayMoodEn || 'fresh, youthful, softly innocent everyday charm'
    ),
    silhouetteTendenciesEn: asStringArray(rawPolicy.silhouetteTendenciesEn || [
      'clean school-age casual silhouettes',
      'light layered balance rather than heavy styling',
      'soft movement suitable for ordinary daily action'
    ], 8),
    fabricTendenciesEn: asStringArray(rawPolicy.fabricTendenciesEn || [
      'light knit textures',
      'soft cotton jersey or brushed casual fabric',
      'occasional gentle pleat or rib detail'
    ], 8),
    paletteTendenciesEn: asStringArray(rawPolicy.paletteTendenciesEn || [
      'soft neutrals with small fresh accents',
      'muted cools or milk-light warm tones',
      'small red echoes can appear naturally'
    ], 8),
    accessoryTendenciesEn: asStringArray(rawPolicy.accessoryTendenciesEn || [
      'small practical accessories only',
      'one subtle cute accent is enough'
    ], 6),
    footwearTendenciesEn: asStringArray(rawPolicy.footwearTendenciesEn || [
      'clean everyday sneakers or soft school-age casual shoes',
      'comfortable shoes that match walking and errands'
    ], 6),
    weatherResponseEn: asStringArray(rawPolicy.weatherResponseEn || [
      'adapt layering and fabric weight to the actual weather',
      'rain or cool air may add a light outer layer without making the outfit bulky'
    ], 6),
    freshnessCuesEn: asStringArray(rawPolicy.freshnessCuesEn || [
      'looks lived-in and age-appropriate',
      'keeps a clear, tidy, lightly bright feeling without performance'
    ], 6),
    maturityGuardrailsEn: asStringArray(rawPolicy.maturityGuardrailsEn || [
      'avoid adult officewear codes',
      'avoid nightclub glamour or luxury signaling',
      'avoid costume-like fetishized schoolwear'
    ], 6),
    identityEchoCuesEn: asStringArray(rawPolicy.identityEchoCuesEn || [
      'the small red hairclip may echo the outfit accent when natural',
      'youthful neatness matters more than trendiness'
    ], 6),
    laneTendencies: {
      selfie: normalizeLaneTendency(
        laneTendencies.selfie || {},
        DEFAULT_LANE_TENDENCIES.selfie
      ),
      life_record: normalizeLaneTendency(
        laneTendencies.life_record || {},
        DEFAULT_LANE_TENDENCIES.life_record
      )
    }
  };
}

module.exports = {
  normalizeClothingPolicy
};
