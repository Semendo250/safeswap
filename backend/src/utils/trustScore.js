const BASELINE = 50;
const MAX_SALE_BONUS = 30;
const SALE_BONUS_PER_SALE = 5;
const REPORT_PENALTY_MIN = 15;
const REPORT_PENALTY_MAX = 30;
const FALLBACK_PATH_PENALTY = 10;
const FLAG_REVIEW_THRESHOLD = 30;
const ADMIN_TRUST_SCORE = 99;

function calculateTrustScore(user) {
  // Admin accounts display a fixed trust score, not an earned one
  if (user.isAdmin) {
    return ADMIN_TRUST_SCORE;
  }

  let score = BASELINE;

  const saleBonus = Math.min(user.completedSales * SALE_BONUS_PER_SALE, MAX_SALE_BONUS);
  score += saleBonus;

  score -= user.reportCount * REPORT_PENALTY_MIN;

  if (user.verificationPath === 'fallback') {
    score -= FALLBACK_PATH_PENALTY;
  }

  return Math.max(0, Math.min(100, score));
}

function shouldFlagForReview(score) {
  return score < FLAG_REVIEW_THRESHOLD;
}

module.exports = { calculateTrustScore, shouldFlagForReview, REPORT_PENALTY_MAX };