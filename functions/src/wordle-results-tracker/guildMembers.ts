import { GuildMember } from './parseWordleSummary';
import { GUILD_MEMBER_FETCH_LIMIT } from "./constants";

/**
 * Fetch all guild members for a Discord guild.
 * @param guildId Discord guild ID
 * @param token Bot token
 * @returns Array of guild members
 */
export async function fetchGuildMembers(guildId: string, token: string): Promise<GuildMember[]> {
  let after: string | undefined = undefined;
  let allMembers: GuildMember[] = [];
  let keepGoing = true;
  let backoff = 1000; // Start with 1s
  while (keepGoing) {
    let url = `https://discord.com/api/v10/guilds/${guildId}/members?limit=${GUILD_MEMBER_FETCH_LIMIT}`;
    if (after) url += `&after=${after}`;
    try {
      const resp = await fetch(url, {
        headers: { Authorization: `Bot ${token}` }
      });
      if (resp.status === 429) {
        // Rate limited, wait and retry
        const data = await resp.json();
        const retryAfter = data.retry_after ? Math.ceil(data.retry_after * 1000) : backoff;
        console.warn(`[Wordle] fetchGuildMembers: Rate limited. Retrying after ${retryAfter}ms.`);
        await new Promise(res => setTimeout(res, retryAfter));
        backoff = Math.min(backoff * 2, 30000); // Exponential backoff, max 30s
        continue;
      } else {
        backoff = 1000; // Reset backoff on success
      }
      if (!resp.ok) {
        console.error(`[Wordle] fetchGuildMembers: Non-2xx response (${resp.status}) for URL: ${url}`);
        break;
      }
      const members: GuildMember[] = await resp.json();
      allMembers = allMembers.concat(members);
      if (members.length < GUILD_MEMBER_FETCH_LIMIT) {
        keepGoing = false;
      } else {
        after = members[members.length - 1].user.id;
      }
    } catch (err) {
      console.error(`[Wordle] fetchGuildMembers: Error fetching members:`, err);
      break;
    }
  }
  return allMembers;
} 