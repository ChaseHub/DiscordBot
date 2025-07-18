import { InteractionResponseType } from "discord-interactions";
import { APIEmbed } from "discord-api-types/v10";
import { Command, CommandData } from "./command";

export class HelpCommand extends Command {
    public data: CommandData = {
        name: "help",
        description: "Show help and usage guides for Wordle commands.",
        type: 1, // CHAT_INPUT
    };

    async execute(interaction: any, res: any) {
        const embed: APIEmbed = {
            color: 0x57F287,
            title: "Wordle Bot Help & Commands Guide",
            description: "Here are the available commands and how to use them:",
            fields: [
                {
                    name: "/initsetup date:YYYY-MM-DD",
                    value: "Populate Wordle Firestore with historical data up to a given date. Example: `/initsetup date:2023-01-01`",
                },
                {
                    name: "/printresults",
                    value: "Print the current day's Wordle infographic based on existing data. Does not fetch new results.",
                },
                {
                    name: "/personalstats user:@username",
                    value: "Show personal Wordle stats for the selected user. Example: `/personalstats user:@Alice`",
                },
                {
                    name: "/help",
                    value: "Show this help message.",
                },
            ],
            footer: { text: "Need more help? Contact the server admin or bot maintainer." },
        };
        res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                embeds: [embed],
            },
        });
    }
} 