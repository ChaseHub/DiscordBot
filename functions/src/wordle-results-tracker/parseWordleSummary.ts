// Parses Wordle summary messages and extracts results for storage and stats.

/**
 * Represents a single user's Wordle result.
 */
export interface WordleResult {
  id: string | null;      // Discord user ID (null if not found)
  username?: string;      // Username (if available)
  score: number;          // -1 for fail, 1-6 for success
}

/**
 * Parsed summary of a Wordle message (streak, results, solved/unsolved counts).
 */
export interface ParsedWordleSummary {
  streak: number | null;      // User's streak (if present)
  results: WordleResult[];    // List of results parsed from the message
  solved: number | null;      // Number of solved games (if present)
  unsolved: number | null;    // Number of unsolved games (if present)
}

/**
 * Represents a Discord guild member (for username lookup).
 */
export interface GuildMember {
  user: { id: string; username: string };
  nick?: string;
  [key: string]: any;
}

/**
 * Checks if a message content is a Wordle summary (basic heuristic).
 * @param content The message content
 * @returns True if the message looks like a Wordle summary
 */
export function isWordleSummary(content: string): boolean {
  return content.includes("day streak") && content.includes("Wordle");
}

/**
 * Parses a Wordle summary message and extracts results.
 * @param content The message content
 * @param guildMembers Array of guild member objects for username lookup
 * @returns ParsedWordleSummary or null if parsing fails
 */
export async function parseWordleSummary(content: string, guildMembers: GuildMember[]): Promise<ParsedWordleSummary | null> {
  try {
    const lines = content.split("\n");
    const streak = parseStreak(lines[0]);
    const results = parseResults(lines, guildMembers);
    const { solved, unsolved } = parseSolvedUnsolved(lines);
    if (streak !== null && results.length > 0) {
      return { streak, results, solved, unsolved };
    }
    console.warn(`[Wordle] parseWordleSummary: Failed to parse summary. Content:`, content);
    return null;
  } catch (err) {
    console.error("[Wordle] Error parsing summary:", err);
    console.error("[Wordle] Content:", content);
    return null;
  }
}

// --- Private helpers ---

/**
 * Parses the streak number from the first line of a summary.
 */
function parseStreak(line: string): number | null {
  const streakMatch = line.match(/on a (\d+) day streak/);
  return streakMatch ? parseInt(streakMatch[1], 10) : null;
}

/**
 * Parses all user results from the summary lines.
 */
function parseResults(lines: string[], guildMembers: GuildMember[]): WordleResult[] {
  const results: WordleResult[] = [];
  for (const line of lines) {
    const resultMatch = line.match(/^(?:\ud83d\udc51 )?([X\d])\/6: (.+)$/);
    if (resultMatch) {
      let score: number;
      if (resultMatch[1] === 'X') {
        score = -1;
      } else {
        score = Number(resultMatch[1]);
      }
      const userString = resultMatch[2].trim();
      const userParts = userString.split(/ (?=@|<@)/g);
      for (const part of userParts) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const mentionMatch = trimmed.match(/^<@!?([0-9]+)>$/);
        if (mentionMatch) {
          results.push({
            id: mentionMatch[1],
            score,
          });
        } else if (trimmed.startsWith('@')) {
          const username = trimmed.slice(1);
          let userId: string | null = null;
          if (guildMembers && guildMembers.length > 0) {
            const lowerUsername = username.toLowerCase();
            const matches = guildMembers.filter((m) =>
              m.user.username.toLowerCase() === lowerUsername ||
              (m.nick && m.nick.toLowerCase() === lowerUsername)
            );
            if (matches.length === 1) {
              userId = matches[0].user.id;
            } else if (matches.length > 1) {
              console.warn(`[Wordle] Ambiguous username match for '@${username}': multiple users found.`);
              userId = matches[0].user.id;
            } else {
              console.warn(`[Wordle] Username '@${username}' not found in guild members.`);
            }
          }
          results.push({
            id: userId,
            username,
            score,
          });
        }
      }
    }
  }
  return results;
}

/**
 * Parses solved/unsolved counts from the summary lines.
 */
function parseSolvedUnsolved(lines: string[]): { solved: number | null; unsolved: number | null } {
  let solved: number | null = null, unsolved: number | null = null;
  for (const line of lines) {
    const solvedMatch = line.match(/(\d+) solved and (\d+) unsolved games of Wordle/);
    if (solvedMatch) {
      solved = parseInt(solvedMatch[1], 10);
      unsolved = parseInt(solvedMatch[2], 10);
    }
  }
  return { solved, unsolved };
} 