// Handles storing parsed Wordle results in Firestore, with deduplication.

import { getFirestore } from "firebase-admin/firestore";
import { ParsedWordleSummary } from "./parseWordleSummary";

/**
 * Stores a parsed Wordle result in Firestore, avoiding duplicates for the same day.
 * @param date The date to store the result under (should be the Wordle day, not message day)
 * @param parsed The parsed Wordle summary object
 */
export async function storeWordleResult(date: Date, parsed: ParsedWordleSummary): Promise<void> {
  const firestore = getFirestore();
  // Normalize date to YYYY-MM-DD for deduplication and storage
  const dateString = date.toISOString().slice(0, 10);
  const firestoreData = {
    date: dateString,
    results: parsed.results.map(r => ({
      id: r.id,
      score: r.score // -1 for fail, 1-6 for success
    }))
  };
  try {
    // Check for duplicates: same date and user IDs
    const snapshot = await firestore.collection("wordleResults")
      .where("date", "==", dateString)
      .get();
    let isDuplicate = false;
    snapshot.forEach(doc => {
      const data = doc.data();
      const existingIds = (data.results || []).map((r: any) => r.id).sort().join(',');
      const newIds = firestoreData.results.map(r => r.id).sort().join(',');
      if (existingIds === newIds) {
        isDuplicate = true;
      }
    });
    if (isDuplicate) {
      console.log(`[Wordle] storeWordleResult: Duplicate result for date ${dateString}, skipping.`);
      return;
    }
    await firestore.collection("wordleResults").add(firestoreData);
  } catch (err) {
    console.error(`[Wordle] storeWordleResult: Error storing result:`, err);
  }
} 