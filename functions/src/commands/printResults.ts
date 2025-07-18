// Implements the /printresults command for the Wordle bot.
// Posts the current day's Wordle infographic to the channel.

import { InteractionResponseType } from "discord-interactions";
import { Command, CommandData } from "./command";
import { aggregateWordleStats } from "../wordle-results-tracker/aggregateStats";
import { postResultsInfographic } from "../wordle-results-tracker/resultsInfographic";
import { fetchGuildMembers } from "../wordle-results-tracker/guildMembers";
import { WORDLE_CHANNEL_ID, GUILD_ID } from "../index";

/**
 * The /printresults command posts the latest Wordle infographic to the channel.
 */
export class PrintResultsCommand extends Command {
    public data: CommandData = {
        name: "printresults",
        description: "Print the current day's Wordle infographic based on existing data.",
        type: 1, // CHAT_INPUT
    };

    /**
     * Posts the Wordle infographic for the current data in Firestore.
     * @param interaction Discord interaction object
     * @param res Response object
     * @param token Discord bot token
     */
    async execute(interaction: any, res: any, token: string) {
        try {
            // Use hardcoded channel and guild IDs
            const channelId = WORDLE_CHANNEL_ID;
            const guildId = GUILD_ID;
            if (!channelId || !guildId || !token) {
                let missing = [];
                if (!channelId) missing.push('channel');
                if (!guildId) missing.push('guild');
                if (!token) missing.push('bot token');
                res.send({
                    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: { content: `Missing: ${missing.join(', ')}.` }
                });
                return;
            }
            // Build userId to username map from guild members
            const guildMembers = await fetchGuildMembers(guildId, token);
            const userIdToName: Record<string, string> = {};
            for (const member of guildMembers) {
                userIdToName[member.user.id] = member.nick || member.user.username;
            }
            // Aggregate stats and post infographic (no new data fetched)
            const stats = await aggregateWordleStats(userIdToName);
            await postResultsInfographic(channelId, token, stats, userIdToName);
            res.send({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: "Wordle infographic posted for today based on current data." }
            });
        } catch (err) {
            console.error('[Wordle] printResults error:', err);
            res.send({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: `Error printing results: ${err}` }
            });
        }
    }
} 