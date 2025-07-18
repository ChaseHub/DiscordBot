// Shared formatting utilities for Wordle results

/**
 * Returns an emoji representing the Wordle score.
 * @param score Number of guesses (1-6), or -1 for fail
 */
export function getResultEmoji(score: number): string {
  if (score === -1) return "❌";
  if (score === 1) return "🎯";
  if (score <= 3) return "✅";
  if (score <= 5) return "👍";
  if (score === 6) return "😅";
  return "🤔";
}

/**
 * Returns the most common score from a distribution object.
 * @param distribution Record<string, number> of scores
 */
export function getMostCommonScore(distribution: Record<string, number>): number {
  let mostCommon = 0;
  let maxCount = -1;
  for (let i = 1; i <= 6; i++) {
    const count = distribution[i] || 0;
    if (count > maxCount) {
      maxCount = count;
      mostCommon = i;
    }
  }
  return mostCommon;
} 