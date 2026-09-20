// Rule-based, explainable trust score - not a black-box model.
// Baseline 50, adjusted by clear, documentable rules.

const BASELINE = 50;
const MAX_SALE_BONUS = 30;
const SALE_BONUS_PER_SALE = 5;
const REPORT_PENALTY_MIN = 15;
const REPORT_PENALTY_MAX = 30;
const FALLBACK_PATH_PENALTY = 10;
const FLAG_REVIEW_THRESHOLD = 30;

function calculateTrustScore(user) {
  let score = BASELINE;

  // Reward clean completed sales, capped so it can't run away
  const saleBonus = Math.min(user.completedSales * SALE_BONUS_PER_SALE, MAX_SALE_BONUS);
  score += saleBonus;

  // Penalize upheld reports more heavily than the sale bonus rewards,
  // so trust is harder to earn back than to lose
  score -= user.reportCount * REPORT_PENALTY_MIN;

  // Verification path penalty
  if (user.verificationPath === 'fallback') {
    score -= FALLBACK_PATH_PENALTY;
  }

  // Clamp between 0 and 100
  return Math.max(0, Math.min(100, score));
}

function shouldFlagForReview(score) {
  return score < FLAG_REVIEW_THRESHOLD;
}

module.exports = { calculateTrustScore, shouldFlagForReview, REPORT_PENALTY_MAX };
