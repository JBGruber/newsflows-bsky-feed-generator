import { Database } from '../db';
import { getFollowsApi } from '../algos/queries';

// Track active timers
let activeTimers: NodeJS.Timeout[] = [];

/**
 * Updates follows data for all subscribers in the database
 * This runs as a scheduled task to keep follow data fresh
 */
export async function updateAllSubscriberFollows(db: Database, updateAll: boolean = false): Promise<void> {
  try {
    console.log('Starting scheduled update of subscriber follows...');
    
    // Get all subscribers from the database
    const subscribers = await db
      .selectFrom('subscriber')
      .select(['did'])
      .execute();
    
    console.log(`Starting scheduled update of follows for ${subscribers.length} subscribers`);
    
    for (const subscriber of subscribers) {
      try {
        await getFollowsApi(subscriber.did, db, updateAll);
      } catch (error) {
        console.error(`Error updating follows for ${subscriber.did}:`, error);
      }
    }
    
  } catch (error) {
    console.error('Error in scheduled follows update:', error);
  }
}

export function setupFollowsUpdateScheduler(
  db: Database, 
  intervalMs: number = 60 * 60 * 1000, // Default: 1 hour
  runImmediately: boolean = true,
  updateAll: boolean = false
): NodeJS.Timeout {
  
  if (runImmediately) {
    updateAllSubscriberFollows(db).catch(err => {
      console.error('Error in initial follows update:', err);
    });
  }
  
  // Set up recurring interval
  const timerId = setInterval(() => {
    updateAllSubscriberFollows(db, updateAll).catch(err => {
      console.error('Error in scheduled follows update:', err);
    });
  }, intervalMs);
  
  // Add to active timers list
  activeTimers.push(timerId);
  return timerId;
}

// Updates follows for a single subscriber without blocking
export function triggerFollowsUpdateForSubscriber(db: Database, did: string): void {
  // Run in the next event loop tick to avoid blocking
  setTimeout(async () => {
    try {
      console.log(`Background update: fetching follows for new subscriber ${did}`);
      await getFollowsApi(did, db);
    } catch (error) {
      console.error(`Error updating follows for ${did}:`, error);
    }
  }, 0);
}

// Stop all running schedulers
export function stopAllSchedulers(): void {
  console.log(`Stopping ${activeTimers.length} active schedulers`);
  activeTimers.forEach(timerId => {
    clearInterval(timerId);
  });
  activeTimers = [];
}
