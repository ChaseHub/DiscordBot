import { ComponentType, RESTPostAPIChannelMessageJSONBody, APIEmbed, APIActionRowComponent, APIButtonComponent, ButtonStyle } from "discord-api-types/v10";
import { AggregatedStats, DailySummary, UserStats } from "./aggregateStats";
import { WordleResult } from "./parseWordleSummary";
import { getMostCommonScore, getResultEmoji } from "./formatUtils";

/**
 * Discord embed limits (as of 2024):
 * - Max 10 embeds per message
 * - Max 25 fields per embed
 * - Max 6000 characters per message
 * - Max 256 characters for embed title
 * - Max 1024 characters for embed field name/value
 * - Max 4096 characters for embed description
 * - Max 200 characters for footer text
 * - Max 5 action rows per message
 * - Max 5 buttons per action row
 * See: https://discord.com/developers/docs/resources/channel#create-message
 */
/**
 * Posts the Wordle results infographic to a Discord channel.
 * @param channelId Discord channel ID
 * @param token Bot token
 * @param stats Aggregated stats from Firestore
 * @param userIdToName Map of user IDs to usernames
 */
export async function postResultsInfographic(
  channelId: string,
  token: string,
  stats: AggregatedStats,
  userIdToName: Record<string, string>
): Promise<void> {
  const payload = buildResultsInfographic(stats, userIdToName);
  const postUrl = `https://discord.com/api/v10/channels/${channelId}/messages`;

  const resp = await fetch(postUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bot ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const errorText = await resp.text();
    console.error(`[Wordle] postResultsInfographic: Non-2xx response (${resp.status}) posting infographic to channel ${channelId}`);
    console.error(`[Wordle] Response status: ${resp.status} ${resp.statusText}`);
    console.error(`[Wordle] Response body: ${errorText}`);
    console.error(`[Wordle] Request payload: ${JSON.stringify(payload, null, 2)}`);
    throw new Error(`Failed to post infographic: ${resp.status} ${resp.statusText} - ${errorText}`);
  } else {
    const responseText = await resp.text();
    console.log(`[Wordle] Successfully posted infographic to channel ${channelId}`);
    if (responseText) {
      console.log(`[Wordle] Response: ${responseText}`);
    }
  }
}

function buildResultsInfographic(stats: AggregatedStats, userIdToName: Record<string, string>): RESTPostAPIChannelMessageJSONBody {
  const { dailySummary, userStats } = stats;

  if (!dailySummary || dailySummary.totalPlayers === 0) {
    return {
      embeds: [{
        title: "😴 No Wordle Results Yesterday",
        description: "It looks like no one submitted their Wordle results for yesterday. Be the first next time!",
        color: 0x5865F2, // Discord Blurple
      }]
    };
  }

  // --- BUILD THE THREE DISTINCT EMBEDS ---
  const dailySummaryEmbed = buildDailySummaryEmbed(dailySummary, userStats);
  const fullResultsEmbed = buildFullResultsEmbed(dailySummary, userStats);
  const leaderboardEmbed = buildLeaderboardEmbed(Object.values(userStats));
  
  // --- BUILD INTERACTIVE COMPONENTS ---
  const actionRow: APIActionRowComponent<APIButtonComponent> = {
    type: ComponentType.ActionRow,
    components: [
      {
        type: ComponentType.Button,
        style: ButtonStyle.Link,
        label: "Play Today's Wordle",
        url: "https://www.nytimes.com/games/wordle/index.html",
        emoji: { name: "🔗" }
      },
    ]
  };

  return {
    content: `**Wordle Report is in!** Here's the breakdown for **yesterday (${dailySummary.date})**.`,
    embeds: [dailySummaryEmbed, fullResultsEmbed, leaderboardEmbed],
    components: [actionRow],
  };
}


// --- 1. DAILY SUMMARY EMBED BUILDER ---
function buildDailySummaryEmbed(summary: DailySummary, userStats: Record<string, UserStats>): APIEmbed {
  const sortedWinners = [...summary.winners].sort((a, b) => (a.score as number) - (b.score as number));
  const topPlayerResult = sortedWinners[0];
  const topPlayerStats = topPlayerResult ? userStats[topPlayerResult.id || ''] : null;

  const embedColor = summary.successRate >= 75 ? 0x57F287 : summary.successRate >= 50 ? 0xFEE75C : 0xED4245;

  let description = `A total of **${summary.totalPlayers}** players competed yesterday.`;
  if (topPlayerStats) {
    description += `\n\nCrowning yesterday's champion, **${topPlayerStats.username}**, for solving it in **${topPlayerResult.score}** guesses! 👑`;
  }
  
  return {
    color: embedColor,
    title: `🎯 Wordle Report: ${summary.date}${summary.wordleNumber ? ` (#${summary.wordleNumber})` : ''}`,
    description: description,
    thumbnail: { url: "https://i.imgur.com/8WCoS7q.png" },
    fields: [
      {
        name: "🏆 Yesterday's Podium",
        value: formatPodium(sortedWinners, userStats),
        inline: true
      },
      {
        name: "📈 Yesterday's Statistics",
        value: formatDailyStats(summary),
        inline: true
      },
      {
        name: "📊 Guess Distribution",
        value: createDistributionChart(summary.distribution, summary.totalPlayers),
        inline: false,
      }
    ],
    footer: {
      text: `Fun Fact: ${getFunFact(summary)}`,
      icon_url: "https://i.imgur.com/3Q3Y6A1.png"
    },
    timestamp: new Date(summary.date).toISOString(),
  };
}


// --- 2. FULL DAILY RESULTS EMBED BUILDER ---
function buildFullResultsEmbed(summary: DailySummary, userStats: Record<string, UserStats>): APIEmbed {
    // Sort all players: solved first (by score), then unsolved
    const sortedResults = [...summary.results].sort((a, b) => {
        const aScore = a.score === -1 ? 99 : a.score;
        const bScore = b.score === -1 ? 99 : b.score;
        return aScore! - bScore!;
    });

    const resultsList = sortedResults.map(r => {
        const user = userStats[r.id || ''];
        const emoji = getResultEmoji(r.score);
        const scoreText = r.score === -1 ? "Failed" : `${r.score}/6`;
        return `${emoji} **${user?.username || 'Unknown'}** - ${scoreText}`;
    }).join('\n');

    return {
        color: 0x95A5A6, // A neutral, clean color (Cloudy Grey)
        title: "📋 Yesterday's Full Scoreboard",
        description: resultsList || "No results to display.",
    };
}


// --- 3. ALL-TIME LEADERBOARD EMBED BUILDER ---
function buildLeaderboardEmbed(allUserStats: UserStats[]): APIEmbed {
    // --- NEW: Most Solves by Guess Count ---
    const mostSolvesByGuess: string[] = [];
    for (let guess = 1; guess <= 6; guess++) {
        // Find the max number of solves for this guess count
        let max = 0;
        for (const user of allUserStats) {
            const count = user.guessCounts?.[guess] || 0;
            if (count > max) max = count;
        }
        // Find all users with this max
        const topUsers = allUserStats.filter(u => (u.guessCounts?.[guess] || 0) === max && max > 0);
        if (topUsers.length > 0) {
            const userList = topUsers.map(u => `**${u.username}**`).join(', ');
            mostSolvesByGuess.push(`**${guess}/6:** ${userList} (${max} time${max === 1 ? '' : 's'})`);
        } else {
            mostSolvesByGuess.push(`**${guess}/6:** *No solves yet*`);
        }
    }
    return {
        color: 0x3498DB, // A strong, professional blue (Peter River)
        title: "📜 All-Time Server Leaderboards",
        description: "Ranking the server's all-time greatest Wordle players.",
        fields: [
            {
                name: "🔥 Longest Max Streak",
                value: formatLeaderboardCategory(allUserStats, s => s.maxStreak, v => `${v} days`, 'desc'),
                inline: false,
            },
            {
                name: "⭐ Best Win Rate",
                value: formatLeaderboardCategory(allUserStats, s => s.winRate, v => `${((v || 0) * 100).toFixed(1)}%`, 'desc'),
                inline: false,
            },
            {
                name: "🧠 Best Average Score",
                value: formatLeaderboardCategory(allUserStats, s => s.averageScore, v => v!.toFixed(2), 'asc'),
                inline: false,
            },
            {
                name: "🏅 Most Solves by Guess Count",
                value: mostSolvesByGuess.join('\n'),
                inline: false,
            },
        ],
        footer: { text: "Keep playing to climb the ranks!" }
    };
}


// --- ADVANCED LEADERBOARD FORMATTER WITH TIE-HANDLING ---
function formatLeaderboardCategory(
    stats: UserStats[],
    valueExtractor: (s: UserStats) => number | null,
    valueFormatter: (v: number | null) => string,
    sortDirection: 'asc' | 'desc'
): string {
    const medals = ["🥇", "🥈", "🥉"];
    let leaderboardText = "";
    const placedUsers = new Set<string>();

    const relevantStats = stats.filter(s => valueExtractor(s) !== null && valueExtractor(s) !== undefined);

    if (relevantStats.length === 0) return "*Not enough data yet.*";

    for (const medal of medals) {
        const remainingStats = relevantStats.filter(s => !placedUsers.has(s.id));
        if (remainingStats.length === 0) break;

        remainingStats.sort((a, b) => {
            const valA = valueExtractor(a)!;
            const valB = valueExtractor(b)!;
            return sortDirection === 'desc' ? valB - valA : valA - valB;
        });

        const topValue = valueExtractor(remainingStats[0]);
        const tiedPlayers = remainingStats.filter(s => valueExtractor(s) === topValue);

        if (tiedPlayers.length === 0) continue;
        
        const formattedValue = `**${valueFormatter(topValue)}**`;
        const tieSuffix = tiedPlayers.length > 1 ? ` (${tiedPlayers.length}-way tie)` : "";

        leaderboardText += `${medal} ${formattedValue}${tieSuffix}\n`;
        leaderboardText += tiedPlayers.map(p => `  • ${p.username}`).join('\n') + '\n\n';
        
        tiedPlayers.forEach(p => placedUsers.add(p.id));

        if (placedUsers.size >= relevantStats.length) break;
    }

    return leaderboardText.trim() || "*Not enough data yet.*";
}


// --- OTHER FORMATTING UTILITIES (Mostly unchanged, with minor tweaks) ---

function formatPodium(winners: WordleResult[], userStats: Record<string, UserStats>): string {
  const medals = ["🥇", "🥈", "🥉"];
  return winners.slice(0, 3)
    .map((r, i) => `${medals[i]} **${userStats[r.id || '']?.username || 'Unknown'}** (${r.score}/6)`)
    .join("\n") || "*No successful solves today.*";
}

function formatDailyStats(summary: DailySummary): string {
  return [
    `**Success Rate**: ${summary.successRate.toFixed(1)}%`,
    `**Avg. Score**: ${summary.averageScore?.toFixed(2) || 'N/A'}`,
    `**Failed**: ${summary.distribution['-1'] || 0} player(s)`
  ].join("\n");
}

function createDistributionChart(distribution: Record<string, number>, totalPlayers: number): string {
  const barLength = 12;
  let chart = "```ansi\n";
  for (let i = 1; i <= 6; i++) {
    const count = distribution[i] || 0;
    const percent = totalPlayers > 0 ? count / totalPlayers : 0;
    const filledBars = Math.round(percent * barLength);
    // Using ANSI color codes for a green bar
    const bar = `${'█'.repeat(filledBars)}${'░'.repeat(barLength - filledBars)}`;
    chart += `${i}: ${bar} ${count}\n`;
  }
  // Add fail row
  const failCount = distribution['-1'] || 0;
  const failPercent = totalPlayers > 0 ? failCount / totalPlayers : 0;
  const failBars = Math.round(failPercent * barLength);
  chart += `F: ${'█'.repeat(failBars)}${'░'.repeat(barLength - failBars)} ${failCount}\n`;
  chart += "```";
  return chart;
}

// getResultEmoji is imported from formatUtils.ts
// Emoji meanings:
//   ❌  = Fail (-1)
//   🎯  = Solved in 1 guess
//   ✅  = Solved in 2-3 guesses
//   👍  = Solved in 4-5 guesses
//   😅  = Solved in 6 guesses
//   🤔  = Unknown/other
function getFunFact(summary: DailySummary): string {
  const oneTry = summary.distribution['1'] || 0;
  if (oneTry > 0) return `Someone got a hole-in-one yesterday! Incredible!`;

  const sixTries = summary.distribution['6'] || 0;
  if (sixTries > summary.totalPlayers / 3) return `Yesterday was a nail-biter for many, with lots of 6/6 solves!`;

  if (summary.successRate < 50) return `Oof! Yesterday's word was a real challenge for the group.`;
  
  // Use fail count
  const failCount = summary.distribution['-1'] || 0;
  if (failCount > 0) return `There were ${failCount} failed attempts yesterday. Keep trying!`;

  return `The most common score yesterday was ${getMostCommonScore(summary.distribution)} guesses.`;
}