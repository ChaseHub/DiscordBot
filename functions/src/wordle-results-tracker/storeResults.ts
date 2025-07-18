import { getFirestore } from "firebase-admin/firestore";
import { ParsedWordleSummary } from "./parseWordleSummary";

/**
 * Store a parsed Wordle result in Firestore, avoiding duplicates.
 * @param date The date of the result (from message timestamp)
 * @param parsed The parsed Wordle summary
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
    // Deduplication: check if a result with the same date string and user IDs exists
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