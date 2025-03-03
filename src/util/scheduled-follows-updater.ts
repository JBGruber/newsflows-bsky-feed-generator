import { Database } from '../db';
import { getFollowsApi } from '../algos/queries';

// Track active timers
let activeTimers: NodeJS.Timeout[] = [];

/**
 * Updates follows data for all subscribers in the database
 * This runs as a scheduled task to keep follow data fresh
 */
export async function updateAllSubscriberFollows(db: Database): Promise<void> {
  try {
    // TODO: remove some of these log messages if everything is working
    console.log('Starting scheduled update of subscriber follows...');
    
    // Get all subscribers from the database
    const subscribers = await db
      .selectFrom('subscriber')
      .select(['did'])
      .execute();
    
    console.log(`Found ${subscribers.length} subscribers to update`);
    
    // Process each subscriber
    for (const subscriber of subscribers) {
      try {
        console.log(`Updating follows for ${subscriber.did}`);
        // Call getFollowsApi to fetch and store the follows
        await getFollowsApi(subscriber.did, db);
      } catch (error) {
        // Log errors but continue with other subscribers
        console.error(`Error updating follows for ${subscriber.did}:`, error);
      }
    }
    
    console.log('Completed scheduled update of subscriber follows');
  } catch (error) {
    console.error('Error in scheduled follows update:', error);
  }
}

export function setupFollowsUpdateScheduler(
  db: Database, 
  intervalMs: number = 60 * 60 * 1000, // Default: 1 hour
  runImmediately: boolean = true
): NodeJS.Timeout {
  console.log(`Setting up follows update scheduler to run every ${intervalMs/1000} seconds`);
  
  // Run once immediately on startup if requested
  if (runImmediately) {
    updateAllSubscriberFollows(db).catch(err => {
      console.error('Error in initial follows update:', err);
    });
  }
  
  // Set up recurring interval
  const timerId = setInterval(() => {
    updateAllSubscriberFollows(db).catch(err => {
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
      console.log(`Background update: completed fetching follows for ${did}`);
    } catch (error) {
      console.error(`Error updating follows for ${did}:`, error);
    }
  }, 0);
}

/**
 * Stop all running schedulers
 */
export function stopAllSchedulers(): void {
  console.log(`Stopping ${activeTimers.length} active schedulers`);
  activeTimers.forEach(timerId => {
    clearInterval(timerId);
  });
  activeTimers = [];
}