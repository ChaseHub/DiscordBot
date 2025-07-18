// Main entry point for the Discord Wordle Results Tracker Bot
// Handles Discord interactions, command registration, and scheduled Wordle result aggregation.

import { onRequest } from "firebase-functions/v2/https";
import { InteractionType, InteractionResponseType, verifyKey } from "discord-interactions";
import { defineSecret } from "firebase-functions/params";
import { Command } from "./commands/command";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { initializeApp } from "firebase-admin/app";
import { trackWordleResults } from "./wordle-results-tracker/trackWordleResults";
import { InitSetupCommand } from "./commands/initSetup";
import { PersonalStatsCommand } from "./commands/personalStats";
import { PrintResultsCommand } from "./commands/printResults";
import { HelpCommand } from "./commands/help";

// Initialize Firebase Admin SDK
initializeApp();

// Discord channel and server IDs (set these to your server's values)
export const WORDLE_CHANNEL_ID = "1223013428365492236"; // Replace with your channel ID
export const GUILD_ID = "1223013427371446453"; // Set your Discord server ID here

// List of all available slash commands
const commands: Command[] = [
    new InitSetupCommand(),
    new PersonalStatsCommand(),
    new PrintResultsCommand(),
    new HelpCommand(),
    // Add new Command instances here
];

// Define secrets for Discord and admin credentials
const DISCORD_PUBLIC_KEY = defineSecret("DISCORD_PUBLIC_KEY");
const DISCORD_BOT_TOKEN = defineSecret("DISCORD_BOT_TOKEN");
const DISCORD_APPLICATION_ID = defineSecret("DISCORD_APPLICATION_ID");
const ADMIN_PASSWORD = defineSecret("ADMIN_PASSWORD");

/**
 * Main HTTP endpoint for Discord interactions (slash commands, pings, etc).
 * Verifies requests, routes to the correct command, and handles errors.
 */
export const handleInteraction = onRequest(
    { secrets: [DISCORD_PUBLIC_KEY, DISCORD_BOT_TOKEN] },
    async (req, res) => {
        // Ensure required headers are present
        const signature = req.get("X-Signature-Ed25519");
        const timestamp = req.get("X-Signature-Timestamp");
        const publicKey = DISCORD_PUBLIC_KEY.value();

        if (!signature || !timestamp || !publicKey) {
            res.status(401).end("Missing signature, timestamp, or public key");
            return;
        }

        // Firebase v2 onRequest provides req.rawBody, but ensure it's present
        if (!req.rawBody) {
            res.status(400).end("Missing rawBody");
            return;
        }

        // Verify the request signature
        let isValidRequest = false;
        try {
            isValidRequest = await verifyKey(
                req.rawBody,
                signature,
                timestamp,
                publicKey
            );
        } catch (e) {
            console.error("Error verifying key:", e);
            res.status(401).end("Bad request signature");
            return;
        }

        if (!isValidRequest) {
            res.status(401).end("Bad request signature");
            return;
        }

        // Parse the interaction body
        let interaction = req.body;
        // If body is a Buffer, parse as JSON
        if (Buffer.isBuffer(interaction)) {
            try {
                interaction = JSON.parse(interaction.toString("utf8"));
            } catch (e) {
                res.status(400).send({ error: "Invalid JSON" });
                return;
            }
        }

        // Handle Discord PING (for verification)
        if (interaction.type === InteractionType.PING) {
            console.log("Handling Ping request");
            res.send({ type: InteractionResponseType.PONG });
            return;
        }

        // Handle slash commands
        if (interaction.type === InteractionType.APPLICATION_COMMAND) {
            const commandName = interaction.data?.name?.toLowerCase?.();
            const command = commands.find(cmd => cmd.data.name === commandName);
            if (command) {
                try {
                    // Only pass the token to commands that require it (not HelpCommand)
                    if (command instanceof HelpCommand) {
                        await command.execute(interaction, res);
                    } else {
                        await command.execute(interaction, res, DISCORD_BOT_TOKEN.value());
                    }
                } catch (err) {
                    console.error(`Error executing command ${commandName}:`, err);
                    res.status(500).send({ error: "Command execution error" });
                }
                return;
            } else {
                console.warn(`Unknown command: ${commandName}`);
                res.status(400).send({ error: "Unknown command" });
                return;
            }
        }

        // Unknown interaction type
        console.error("Unknown Interaction type");
        res.status(400).send({ error: "Unknown Interaction type" });
        return;
    }
);

/**
 * HTTP endpoint to register all slash commands with Discord.
 * Only needs to be called when commands are added or updated.
 * Requires admin password (via query, header, or body).
 */
export const registerCommands = onRequest(
    { secrets: [DISCORD_BOT_TOKEN, DISCORD_APPLICATION_ID, ADMIN_PASSWORD] },
    async (req, res) => {
        // Password check: allow password via query (?password=...), header (x-admin-password), or body.password
        const password = req.query.password || req.get("x-admin-password") || req.body?.password;
        if (password !== ADMIN_PASSWORD.value()) {
            res.status(403).send("Forbidden: Invalid password.");
            return;
        }

        const token = DISCORD_BOT_TOKEN.value();
        const applicationId = DISCORD_APPLICATION_ID.value();

        if (!token || !applicationId) {
            res.status(500).send("Bot Token or Application ID are not configured in secrets.");
            return;
        }

        // The URL to PUT the commands to.
        // Use /guilds/<GUILD_ID>/commands for server-specific registration (faster propagation)
        const url = `https://discord.com/api/v10/applications/${applicationId}/commands`;

        try {
            console.log("Registering commands:", commands.map(cmd => cmd.data));
            const response = await fetch(url, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bot ${token}`,
                },
                body: JSON.stringify(commands.map(cmd => cmd.data)),
            });

            if (response.ok) {
                const data = await response.json();
                console.log("Successfully registered commands:", data);
                res.status(200).send("Commands registered successfully!");
            } else {
                const errorText = await response.text();
                console.error("Error registering commands:", errorText);
                res.status(500).send(`Error registering commands: ${errorText}`);
            }
        } catch (error) {
            console.error("Error sending request to Discord API:", error);
            res.status(500).send("An unexpected error occurred.");
        }
    }
);

/**
 * Scheduled function to fetch and aggregate Wordle results every morning at 6am.
 * Posts the daily infographic to the configured Discord channel.
 */
export const fetchWordleResults = onSchedule({
    schedule: "0 6 * * *",
    timeZone: "America/Chicago", 
    secrets: [DISCORD_BOT_TOKEN],
}, async (event) => {
    const token = DISCORD_BOT_TOKEN.value();
    await trackWordleResults(WORDLE_CHANNEL_ID, GUILD_ID, token);
});