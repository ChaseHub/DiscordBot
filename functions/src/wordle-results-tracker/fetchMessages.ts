// Fetches messages from a Discord channel since a given date, paginating as needed
import { MESSAGE_FETCH_LIMIT } from "./constants";
export interface DiscordMessage {
  id: string;
  content: string;
  timestamp: string;
  [key: string]: any;
}

/**
 * Fetch all messages from a Discord channel since a given date.
 * @param channelId Discord channel ID
 * @param token Bot token
 * @param since Date to fetch messages since
 * @returns Array of Discord messages
 */
export async function fetchMessages(channelId: string, token: string, since: Date): Promise<DiscordMessage[]> {
  const url = `https://discord.com/api/v10/channels/${channelId}/messages?limit=${MESSAGE_FETCH_LIMIT}`;
  let lastMessageId: string | undefined = undefined;
  let keepFetching = true;
  const allMessages: DiscordMessage[] = [];
  let fetchCount = 0;
  let backoff = 1000; // Start with 1s
  while (keepFetching) {
    let fetchUrl = url;
    if (lastMessageId) fetchUrl += `&before=${lastMessageId}`;
    try {
      const response = await fetch(fetchUrl, {
        headers: { Authorization: `Bot ${token}` }
      });
      if (response.status === 429) {
        // Rate limited, wait and retry
        const data = await response.json();
        const retryAfter = data.retry_after ? Math.ceil(data.retry_after * 1000) : backoff;
        console.warn(`[Wordle] fetchMessages: Rate limited. Retrying after ${retryAfter}ms.`);
        await new Promise(res => setTimeout(res, retryAfter));
        backoff = Math.min(backoff * 2, 30000); // Exponential backoff, max 30s
        continue;
      } else {
        backoff = 1000; // Reset backoff on success
      }
      if (!response.ok) {
        console.error(`[Wordle] fetchMessages: Non-2xx response (${response.status}) for URL: ${fetchUrl}`);
        break;
      }
      const messages: DiscordMessage[] = await response.json();
      fetchCount++;
      if (!Array.isArray(messages) || messages.length === 0) {
        break;
      }
      for (const msg of messages) {
        const msgTime = new Date(msg.timestamp);
        if (msgTime < since) {
          keepFetching = false;
          break;
        }
        allMessages.push(msg);
      }
      lastMessageId = messages[messages.length - 1]?.id;
      if (messages.length < MESSAGE_FETCH_LIMIT) {
        break;
      }
    } catch (err) {
      console.error(`[Wordle] fetchMessages: Error fetching messages:`, err);
      break;
    }
  }
  return allMessages;
} 