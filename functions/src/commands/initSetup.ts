// Implements the /initsetup command for the Wordle bot.
// Allows admins to import historical Wordle data into Firestore.

import { InteractionResponseType } from "discord-interactions";
import { Command, CommandData } from "./command";
import { fetchMessages } from "../wordle-results-tracker/fetchMessages";
import { fetchGuildMembers } from "../wordle-results-tracker/guildMembers";
import { isWordleSummary, parseWordleSummary } from "../wordle-results-tracker/parseWordleSummary";
import { storeWordleResult } from "../wordle-results-tracker/storeResults";
import { WORDLE_CHANNEL_ID, GUILD_ID } from "../index";

/**
 * The /initsetup command imports Wordle results from a given date up to now.
 * Useful for first-time setup or backfilling data.
 */
export class InitSetupCommand extends Command {
    public data: CommandData = {
        name: "initsetup",
        description: "Populate Wordle Firestore with historical data up to a given date.",
        type: 1, // CHAT_INPUT
        options: [
            {
                name: "date",
                description: "The last date to import (YYYY-MM-DD)",
                type: 3, // STRING
                required: true,
            }
        ]
    };

    /**
     * Executes the import process, fetching messages and storing results.
     * @param interaction Discord interaction object
     * @param res Response object
     * @param token Discord bot token
     */
    async execute(interaction: any, res: any, token: string) {
        try {
            const dateStr = interaction.data.options?.find((opt: any) => opt.name === "date")?.value;
            if (!dateStr) {
                res.send({
                    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: { content: "You must provide a date (YYYY-MM-DD)." }
                });
                return;
            }
            const sinceDate = new Date(dateStr);
            if (isNaN(sinceDate.getTime())) {
                res.send({
                    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: { content: "Invalid date format. Use YYYY-MM-DD." }
                });
                return;
            }
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

            // Fetch all messages from the given date (inclusive) until now
            const allMessages = await fetchMessages(channelId, token, sinceDate);
            if (!allMessages.length) {
                res.send({
                    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: { content: `No messages found in channel since ${dateStr}.` }
                });
                return;
            }
            const guildMembers = await fetchGuildMembers(guildId, token);
            let storedCount = 0;
            let checkedCount = 0;
            for (const msg of allMessages) {
                if (isWordleSummary(msg.content)) {
                    checkedCount++;
                    const parsed = await parseWordleSummary(msg.content, guildMembers);
                    if (parsed) {
                        // Store as the previous day's Wordle (match trackWordleResults logic)
                        const msgDate = new Date(msg.timestamp);
                        const prevDay = new Date(msgDate.getTime() - 24 * 60 * 60 * 1000);
                        await storeWordleResult(prevDay, parsed);
                        storedCount++;
                    }
                }
            }
            res.send({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: `Historical Wordle data import complete. ${storedCount} new result(s) stored out of ${checkedCount} Wordle summaries found since ${dateStr}.` }
            });
        } catch (err) {
            console.error('[Wordle] initSetup error:', err);
            res.send({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: `Error during setup: ${err}` }
            });
        }
    }
} 