const DAY_IN_MS = 24 * 60 * 60 * 1000;

export type PriorityJob = {
  fitScore: number;
  postedAt: string | null;
};

export function isFreshPosting(postedAt: string | null, now = new Date()): boolean {
  if (!postedAt) return false;
  const posted = new Date(postedAt);
  if (Number.isNaN(posted.getTime())) return false;
  const age = now.getTime() - posted.getTime();
  return age >= 0 && age <= DAY_IN_MS;
}

export function compareJobPriority(a: PriorityJob, b: PriorityJob, now = new Date()): number {
  const freshnessDifference = Number(isFreshPosting(b.postedAt, now)) - Number(isFreshPosting(a.postedAt, now));
  if (freshnessDifference !== 0) return freshnessDifference;

  const fitDifference = b.fitScore - a.fitScore;
  if (fitDifference !== 0) return fitDifference;

  const aTime = a.postedAt ? new Date(a.postedAt).getTime() : 0;
  const bTime = b.postedAt ? new Date(b.postedAt).getTime() : 0;
  return bTime - aTime;
}

export function sortJobsByPriority<T extends PriorityJob>(jobs: T[], now = new Date()): T[] {
  return [...jobs].sort((a, b) => compareJobPriority(a, b, now));
}
