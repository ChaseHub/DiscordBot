import { fetchMessages } from "./fetchMessages";
import { fetchGuildMembers } from "./guildMembers";
import { isWordleSummary, parseWordleSummary } from "./parseWordleSummary";
import { storeWordleResult } from "./storeResults";
import { aggregateWordleStats } from "./aggregateStats";
import { postResultsInfographic } from "./resultsInfographic";

/**
 * Orchestrates the Wordle results tracker process.
 * @param channelId Discord channel ID
 * @param guildId Discord guild ID
 * @param token Bot token
 */
export async function trackWordleResults(channelId: string, guildId: string, token: string): Promise<void> {
  try {
    const now = new Date();
    const since = new Date(now.getTime() - 12 * 60 * 60 * 1000); // 12 hours ago
    const allMessages = await fetchMessages(channelId, token, since);
    const guildMembers = await fetchGuildMembers(guildId, token);
    for (const msg of allMessages) {
      if (isWordleSummary(msg.content)) {
        const parsed = await parseWordleSummary(msg.content, guildMembers);
        if (parsed) {
          // Store as the previous day's Wordle
          const msgDate = new Date(msg.timestamp);
          const prevDay = new Date(msgDate.getTime() - 24 * 60 * 60 * 1000);
          await storeWordleResult(prevDay, parsed);
        }
      }
    }
    // Aggregate stats and build infographic
    // Build userId to username map
    const userIdToName: Record<string, string> = {};
    for (const member of guildMembers) {
      userIdToName[member.user.id] = member.nick || member.user.username;
    }
    const stats = await aggregateWordleStats(userIdToName);
    // Post the infographic to Discord
    await postResultsInfographic(channelId, token, stats, userIdToName);
  } catch (err) {
    console.error('[Wordle] trackWordleResults: Error in orchestrator:', err);
  }
} 