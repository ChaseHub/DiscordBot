// Implements the /personalstats command for the Wordle bot.
// Shows a user's personal Wordle statistics in an embed.

import { InteractionResponseType } from "discord-interactions";
import { APIEmbed } from "discord-api-types/v10";
import { Command, CommandData } from "./command";
import { aggregateWordleStats } from "../wordle-results-tracker/aggregateStats";
import { fetchGuildMembers } from "../wordle-results-tracker/guildMembers";
import { GUILD_ID } from "../index";

/**
 * The /personalstats command displays a user's Wordle stats (games played, win rate, streaks, etc).
 */
export class PersonalStatsCommand extends Command {
    public data: CommandData = {
        name: "personalstats",
        description: "Show personal Wordle stats for a selected user.",
        type: 1, // CHAT_INPUT
    };

    /**
     * Looks up and displays the selected user's Wordle stats.
     * @param interaction Discord interaction object
     * @param res Response object
     * @param token Discord bot token
     */
    async execute(interaction: any, res: any, token: string) {
        try {
            const userId = interaction.data.options?.find((opt: any) => opt.name === "user")?.value;
            if (!userId) {
                res.send({
                    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: { content: "You must select a user." }
                });
                return;
            }
            const guildId = GUILD_ID;
            if (!guildId || !token) {
                let missing = [];
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
            // Aggregate stats
            const stats = await aggregateWordleStats(userIdToName);
            const userStats = stats.userStats[userId];
            if (!userStats) {
                res.send({
                    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: { content: `No Wordle stats found for <@${userId}>.` }
                });
                return;
            }
            // Build embed
            const embed: APIEmbed = {
                color: 0x5865F2,
                title: `Wordle Stats for ${userStats.username}`,
                fields: [
                    { name: "Games Played", value: userStats.gamesPlayed.toString(), inline: true },
                    { name: "Games Solved", value: userStats.gamesSolved.toString(), inline: true },
                    { name: "Win Rate", value: `${(userStats.winRate * 100).toFixed(1)}%`, inline: true },
                    { name: "Average Score", value: userStats.averageScore !== null ? userStats.averageScore.toFixed(2) : "N/A", inline: true },
                    { name: "Current Streak", value: userStats.currentStreak.toString(), inline: true },
                    { name: "Max Streak", value: userStats.maxStreak.toString(), inline: true },
                    { name: "Guess Distribution", value: Object.entries(userStats.distribution).map(([k, v]) => `${k}: ${v}`).join(" | "), inline: false },
                ],
                footer: { text: "Keep playing to improve your stats!" },
            };
            res.send({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                    content: `<@${userId}>'s Wordle stats:`,
                    embeds: [embed],
                },
            });
        } catch (err) {
            console.error('[Wordle] personalStats error:', err);
            res.send({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: `Error fetching personal stats: ${err}` }
            });
        }
    }
} 