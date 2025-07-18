// Defines the base structure for all Discord slash commands used by the Wordle bot.

/**
 * Represents a single option for a slash command (e.g., a parameter).
 */
export interface CommandOption {
    name: string;              // Name of the option
    description: string;       // Description shown in Discord
    type: number;              // Discord API type (e.g., 3 = STRING)
    required?: boolean;        // Whether this option is required
    // Add more fields as needed (choices, etc.)
}

/**
 * Metadata for a Discord slash command.
 */
export interface CommandData {
    name: string;              // Command name (e.g., 'help')
    description: string;       // Command description
    type: number;              // Discord API type (1 = CHAT_INPUT)
    options?: CommandOption[]; // Optional parameters for the command
}

/**
 * Abstract base class for all Wordle bot commands.
 * Each command must define its metadata and implement the execute method.
 */
export abstract class Command {
    public abstract data: CommandData;
    constructor() {}
    /**
     * Executes the command logic.
     * @param interaction The Discord interaction object
     * @param res The response object
     * @param token (Optional) Discord bot token for API calls
     */
    abstract execute(interaction: any, res: any, token: string): Promise<void>;
} 