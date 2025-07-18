// Orchestrates the process of fetching, parsing, storing, and reporting Wordle results.

import { fetchMessages } from "./fetchMessages";
import { fetchGuildMembers } from "./guildMembers";
import { isWordleSummary, parseWordleSummary } from "./parseWordleSummary";
import { storeWordleResult } from "./storeResults";
import { aggregateWordleStats } from "./aggregateStats";
import { postResultsInfographic } from "./resultsInfographic";

/**
 * Fetches recent messages, parses Wordle results, stores them, and posts the daily infographic.
 * @param channelId Discord channel ID to scan for results
 * @param guildId Discord server (guild) ID
 * @param token Discord bot token
 */
export async function trackWordleResults(channelId: string, guildId: string, token: string): Promise<void> {
  try {
    const now = new Date();
    // Only fetch messages from the last 12 hours (adjust as needed)
    const since = new Date(now.getTime() - 12 * 60 * 60 * 1000);
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
    // Build userId to username map for stats and infographic
    const userIdToName: Record<string, string> = {};
    for (const member of guildMembers) {
      userIdToName[member.user.id] = member.nick || member.user.username;
    }
    // Aggregate stats and post infographic
    const stats = await aggregateWordleStats(userIdToName);
    await postResultsInfographic(channelId, token, stats, userIdToName);
  } catch (err) {
    console.error('[Wordle] trackWordleResults: Error in orchestrator:', err);
  }
} 