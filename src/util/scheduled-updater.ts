import { Database } from '../db';
import { getFollowsApi } from './queries';
import { updateEngagement } from './engagement-updater';

// Get all NEWSBOT_*_DID environment variables
function getNewsbotDids(): string[] {
  const newsbotDids: string[] = [];
  Object.keys(process.env).forEach(key => {
    if (key.startsWith('NEWSBOT_') && key.endsWith('_DID')) {
      const did = process.env[key];
      if (did) {
        newsbotDids.push(did);
      }
    }
  });
  return newsbotDids;
}

// Track active timers
let activeTimers: NodeJS.Timeout[] = [];

/**
 * Updates follows data for all subscribers in the database
 * This runs as a scheduled task to keep follow data fresh
 */
export async function updateAllSubscriberFollows(db: Database, updateAll: boolean = false): Promise<void> {
  try {
    // Get newsbot DIDs that should be excluded
    const newsbotDids = getNewsbotDids();
    console.log(`[${new Date().toISOString()}] - Found ${newsbotDids.length} newsbot DIDs to exclude: ${newsbotDids.join(', ')}`);

    // Remove any existing newsbot accounts from follows table
    if (newsbotDids.length > 0) {
      const deletedCount = await db
        .deleteFrom('follows')
        .where('follows', 'in', newsbotDids)
        .execute();

      if (deletedCount.length > 0) {
        console.log(`[${new Date().toISOString()}] - Removed ${deletedCount.length} newsbot accounts from follows table`);
      }
    }

    // Get all subscribers from the database
    const subscribers = await db
      .selectFrom('subscriber')
      .select(['did'])
      .execute();

    console.log(`[${new Date().toISOString()}] - Starting scheduled update of follows for ${subscribers.length} subscribers`);

    for (const subscriber of subscribers) {
      try {
        await getFollowsApi(subscriber.did, db, updateAll, newsbotDids);
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
      console.log(`[${new Date().toISOString()}] - Background update: fetching follows for new subscriber ${did}`);
      const newsbotDids = getNewsbotDids();
      await getFollowsApi(did, db, false, newsbotDids);
    } catch (error) {
      console.error(`Error updating follows for ${did}:`, error);
    }
  }, 0);
}


export function setupEngagmentUpdateScheduler(
  db: Database,
  intervalMs: number = 15 * 60 * 1000, // Default: 15 minutes
  runImmediately: boolean = true,
  updateAll: boolean = false
): NodeJS.Timeout {

  if (runImmediately) {
    updateEngagement(db).catch(err => {
      console.error('Error in initial follows update:', err);
    });
  }

  // Set up recurring interval
  const timerId = setInterval(() => {
    updateEngagement(db).catch(err => {
      console.error('Error in scheduled follows update:', err);
    });
  }, intervalMs);

  // Add to active timers list
  activeTimers.push(timerId);
  return timerId;
}


/**
 * Sets up a daily scheduler that runs at 4:00 AM local time to perform a full sync
 * of all subscriber follows. This removes unfollowed accounts from the database.
 */
export function setupDailyFullSyncScheduler(db: Database): NodeJS.Timeout {
  const runFullSync = () => {
    console.log(`[${new Date().toISOString()}] - Starting daily full sync of all subscriber follows`);
    updateAllSubscriberFollows(db, true).catch(err => {
      console.error('Error in daily full sync:', err);
    });
  };

  // Calculate milliseconds until next 4:00 AM
  const getMillisecondsUntil4AM = (): number => {
    const now = new Date();
    const next4AM = new Date(now);
    next4AM.setHours(4, 0, 0, 0);

    // If it's already past 4:00 AM today, schedule for tomorrow
    if (now.getHours() >= 4) {
      next4AM.setDate(next4AM.getDate() + 1);
    }

    return next4AM.getTime() - now.getTime();
  };

  // Schedule the first run at 4:00 AM
  const msUntil4AM = getMillisecondsUntil4AM();
  console.log(`[${new Date().toISOString()}] - Daily full sync scheduled to run at 4:00 AM (in ${Math.round(msUntil4AM / 1000 / 60 / 60)} hours)`);

  setTimeout(() => {
    runFullSync();

    // After the first run, set up a daily interval (24 hours)
    const dailyInterval = setInterval(() => {
      runFullSync();
    }, 24 * 60 * 60 * 1000); // 24 hours

    activeTimers.push(dailyInterval);
  }, msUntil4AM);

  // Return a dummy timer ID (the real timer will be added to activeTimers after first run)
  const timerId = setTimeout(() => {}, 0); // Placeholder
  activeTimers.push(timerId);
  return timerId;
}

// Stop all running schedulers
export function stopAllSchedulers(): void {
  console.log(`[${new Date().toISOString()}] - Stopping ${activeTimers.length} active schedulers`);
  activeTimers.forEach(timerId => {
    clearInterval(timerId);
  });
  activeTimers = [];
}
