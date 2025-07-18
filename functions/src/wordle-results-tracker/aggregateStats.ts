// Aggregates and summarizes Wordle results for stats and reporting.

import { getFirestore } from "firebase-admin/firestore";
import { WordleResult } from "./parseWordleSummary";

/**
 * User statistics for Wordle games.
 */
export interface UserStats {
  id: string;                   // Discord user ID
  username: string;             // Username or nickname
  gamesPlayed: number;          // Total games played
  gamesSolved: number;          // Games solved (not failed)
  winRate: number;              // Fraction of games solved
  averageScore: number | null;  // Average number of guesses (lower is better)
  currentStreak: number;        // Current win streak
  maxStreak: number;            // Longest win streak
  distribution: Record<string, number>; // Guess distribution (1-6, -1 for fail)
  guessCounts: Record<number, number>;  // Number of solves for each guess count
}

/**
 * Summary of results for a single Wordle day.
 */
export interface DailySummary {
  date: string;                 // Date (YYYY-MM-DD)
  wordleNumber?: number;        // Optional Wordle puzzle number
  totalPlayers: number;         // Number of players who submitted results
  successRate: number;          // Percentage of players who solved
  averageScore: number | null;  // Average score for the day
  distribution: Record<string, number>; // Guess distribution for the day
  winners: WordleResult[];      // List of users who solved
  results: WordleResult[];      // All results (including fails)
}

/**
 * Leaderboards for all-time stats.
 */
export interface AllTimeLeaderboards {
  longestStreak: UserStats[];
  bestWinRate: UserStats[];
  bestAverageScore: UserStats[]; 
}

/**
 * Aggregated stats for the server (daily + all-time).
 */
export interface AggregatedStats {
  dailySummary: DailySummary | null;
  userStats: Record<string, UserStats>;
  allTimeLeaderboards: AllTimeLeaderboards;
}

/**
 * Aggregates all Wordle results from Firestore into a comprehensive stats object.
 * @param userIdToName Map of user IDs to usernames
 * @returns AggregatedStats object with daily and all-time stats
 */
export async function aggregateWordleStats(userIdToName: Record<string, string>): Promise<AggregatedStats> {
  const firestore = getFirestore();
  const snapshot = await firestore.collection("wordleResults").orderBy("date", "desc").get();

  if (snapshot.empty) {
    return { dailySummary: null, userStats: {}, allTimeLeaderboards: { longestStreak: [], bestWinRate: [], bestAverageScore: [] } };
  }

  const allResultsByDate: Record<string, { results: WordleResult[], wordleNumber?: number }> = {};
  const userGameHistory: Record<string, { date: string, score: number | null }[]> = {};

  // Organize all data by date and user
  snapshot.forEach(doc => {
    const data = doc.data();
    const date = (data.date.toDate ? data.date.toDate() : new Date(data.date)).toISOString().slice(0, 10);
    const results = data.results as WordleResult[];

    allResultsByDate[date] = { results, wordleNumber: data.wordleNumber };

    for (const result of results) {
      // Skip if user ID is missing
      if (result.id == null) {
        continue;
      }
      if (!userGameHistory[result.id]) userGameHistory[result.id] = [];
      userGameHistory[result.id].push({ date, score: result.score });
    }
  });

  // Calculate detailed stats for each user
  const userStats: Record<string, UserStats> = {};
  for (const userId in userGameHistory) {
    const games = userGameHistory[userId].sort((a, b) => a.date.localeCompare(b.date)); // Chronological order
    const solvedGames = games.filter(g => g.score !== -1);

    let totalScore = 0;
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, '-1': 0 };
    const guessCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    solvedGames.forEach(g => {
      totalScore += g.score!;
      distribution[g.score! as 1 | 2 | 3 | 4 | 5 | 6]++;
      guessCounts[g.score! as 1 | 2 | 3 | 4 | 5 | 6]++;
    });
    distribution['-1'] = games.length - solvedGames.length;

    // Calculate streaks
    let currentStreak = 0;
    let maxStreak = 0;
    if (games.length > 0) {
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

      // Check if the last game was today or yesterday to be part of a current streak
      const lastGame = games[games.length - 1];
      if (lastGame.score !== -1 && (lastGame.date === today || lastGame.date === yesterday)) {
        // Walk backwards to count streak
        currentStreak = 1;
        for (let i = games.length - 2; i >= 0; i--) {
          const dayDiff = (new Date(games[i + 1].date).getTime() - new Date(games[i].date).getTime()) / 86400000;
          if (games[i].score !== -1 && dayDiff === 1) {
            currentStreak++;
          } else {
            break;
          }
        }
      }

      // Calculate max streak
      let runningStreak = 0;
      for (let i = 0; i < games.length; i++) {
        if (games[i].score !== -1) {
          if (i > 0) {
            const dayDiff = (new Date(games[i].date).getTime() - new Date(games[i - 1].date).getTime()) / 86400000;
            runningStreak = dayDiff === 1 ? runningStreak + 1 : 1;
          } else {
            runningStreak = 1;
          }
        } else {
          runningStreak = 0;
        }
        if (runningStreak > maxStreak) {
          maxStreak = runningStreak;
        }
      }
    }

    userStats[userId] = {
      id: userId,
      username: userIdToName[userId] || `User...${userId.slice(-4)}`,
      gamesPlayed: games.length,
      gamesSolved: solvedGames.length,
      winRate: games.length > 0 ? (solvedGames.length / games.length) : 0,
      averageScore: solvedGames.length > 0 ? totalScore / solvedGames.length : null,
      distribution,
      currentStreak,
      maxStreak,
      guessCounts,
    };
  }

  // Generate Daily Summary for the most recent day
  const mostRecentDate = Object.keys(allResultsByDate).sort().pop()!;
  const latestDayData = allResultsByDate[mostRecentDate];
  const winners = latestDayData.results.filter(r => r.score !== -1);
  const totalScore = winners.reduce((sum, r) => sum + (r.score), 0);
  const dailyDistribution = latestDayData.results.reduce((acc, r) => {
    const key = (r.score === -1 || r.score == null) ? '-1' : r.score.toString();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const dailySummary: DailySummary = {
    date: mostRecentDate,
    wordleNumber: latestDayData.wordleNumber,
    totalPlayers: latestDayData.results.length,
    successRate: latestDayData.results.length > 0 ? (winners.length / latestDayData.results.length) * 100 : 0,
    averageScore: winners.length > 0 ? totalScore / winners.length : null,
    winners,
    results: latestDayData.results,
    distribution: dailyDistribution,
  };

  // Generate All-Time Leaderboards
  const statsList = Object.values(userStats);
  const qualifiedPlayers = statsList.filter(s => s.gamesPlayed);

  const allTimeLeaderboards: AllTimeLeaderboards = {
    longestStreak: [...statsList].sort((a, b) => b.maxStreak - a.maxStreak).slice(0, 5),
    bestWinRate: [...qualifiedPlayers].sort((a, b) => b.winRate - a.winRate).slice(0, 5),
    bestAverageScore: [...qualifiedPlayers].filter(s => s.averageScore !== null).sort((a, b) => a.averageScore! - b.averageScore!).slice(0, 5),
  };

  return { dailySummary, userStats, allTimeLeaderboards };
}