// utils/priceScheduler.js

const scheduledJobs = [];

export function schedulePriceChange({ applyDate, revertDate, applyFn, revertFn, filterType, filterValue, ruleType, valueInput }) {
  const jobId = `${filterType}-${filterValue}-${Date.now()}`;

  if (applyDate) {
    scheduledJobs.push({
      id: jobId,
      runAt: new Date(applyDate),
      fn: () => {
        console.log(`🟢 APPLYING price changes for ${filterType}: ${filterValue}, rule: ${ruleType}, value: ${valueInput}`);
        applyFn();
      },
      type: 'apply',
      executed: false,
    });
  }

  if (revertDate) {
    scheduledJobs.push({
      id: jobId + '-revert',
      runAt: new Date(revertDate),
      fn: () => {
        console.log(`🔴 REVERTING price changes for ${filterType}: ${filterValue}`);
        revertFn();
      },
      type: 'revert',
      executed: false,
    });
  }
}

// Run jobs on interval
export function startScheduler() {
  setInterval(() => {
    const now = new Date();
    for (const job of scheduledJobs) {
      if (!job.executed && job.runAt <= now) {
        console.log(`⏰ Running scheduled job: ${job.type} @ ${job.runAt}`);
        job.fn();
        job.executed = true;
      }
    }
  }, 60 * 1000); // check every minute
}
