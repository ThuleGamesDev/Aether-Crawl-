import type { ActiveStatus, RealtimeStatusId, StatusApplication } from '../types';

export const MAX_ACTIVE_REALTIME_STATUSES = 8;
export const DEFAULT_STATUS_TICK_SECONDS = 1;

export interface StatusTickResult {
  statuses: ActiveStatus[];
  damage: number;
  healing: number;
  ticks: Array<{ statusId: RealtimeStatusId; amount: number }>;
}

/** Refreshes an effect by type instead of stacking an unbounded number of copies. */
export function applyRealtimeStatus(statuses: readonly ActiveStatus[] = [], application: StatusApplication, id = 'combat'): ActiveStatus[] {
  const current = statuses.filter(status => status.durationSeconds > 0).map(status => ({ ...status }));
  const existingIndex = current.findIndex(status => status.statusId === application.statusId);
  const tickInterval = application.tickIntervalSeconds ?? DEFAULT_STATUS_TICK_SECONDS;
  if (existingIndex >= 0) {
    const existing = current[existingIndex];
    current[existingIndex] = {
      ...existing,
      durationSeconds: Math.max(existing.durationSeconds, application.durationSeconds),
      magnitude: Math.max(existing.magnitude, application.magnitude),
      tickRemainingSeconds: Math.min(existing.tickRemainingSeconds ?? tickInterval, tickInterval),
    };
    return current;
  }

  const next: ActiveStatus = {
    id: `${id}:${application.statusId.toLowerCase()}`,
    statusId: application.statusId,
    durationSeconds: Math.max(0, application.durationSeconds),
    magnitude: Math.max(0, application.magnitude),
      ...(isDamageOverTime(application.statusId) ? { tickRemainingSeconds: tickInterval } : {}),
  };
  if (current.length >= MAX_ACTIVE_REALTIME_STATUSES) {
    const replaceIndex = current.reduce((shortest, status, index) => status.durationSeconds < current[shortest].durationSeconds ? index : shortest, 0);
    current.splice(replaceIndex, 1);
  }
  return [...current, next];
}

/** Applies bounded fixed-interval damage-over-time ticks and expires timed effects. */
export function tickRealtimeStatuses(statuses: readonly ActiveStatus[] = [], deltaSeconds: number): StatusTickResult {
  const dt = Math.max(0, Math.min(0.25, deltaSeconds));
  let damage = 0;
  let healing = 0;
  const ticks: StatusTickResult['ticks'] = [];
  const nextStatuses: ActiveStatus[] = [];

  for (const source of statuses) {
    let status = { ...source };
    let timeLeft = dt;
    if (isDamageOverTime(status.statusId)) {
      const interval = DEFAULT_STATUS_TICK_SECONDS;
      let tickRemaining = status.tickRemainingSeconds ?? interval;
      let duration = status.durationSeconds;
      while (timeLeft > 0 && duration > 0) {
        const step = Math.min(timeLeft, duration, tickRemaining);
        timeLeft -= step;
        duration -= step;
        tickRemaining -= step;
        if (tickRemaining <= 0.00001 && duration >= 0) {
          const amount = Math.max(1, Math.floor(status.magnitude));
          damage += amount;
          ticks.push({ statusId: status.statusId, amount });
          tickRemaining += interval;
        }
        if (step <= 0) break;
      }
      status = { ...status, durationSeconds: Math.max(0, duration), tickRemainingSeconds: tickRemaining };
    } else {
      status.durationSeconds = Math.max(0, status.durationSeconds - dt);
    }
    if (status.durationSeconds > 0) nextStatuses.push(status);
  }
  return { statuses: nextStatuses, damage, healing, ticks };
}

export function hasRealtimeStatus(statuses: readonly ActiveStatus[] = [], statusId: RealtimeStatusId): boolean {
  return statuses.some(status => status.statusId === statusId && status.durationSeconds > 0);
}

export function statusMagnitude(statuses: readonly ActiveStatus[] = [], statusId: RealtimeStatusId): number {
  return statuses.reduce((value, status) => status.statusId === statusId && status.durationSeconds > 0 ? Math.max(value, status.magnitude) : value, 0);
}

export function movementSpeedMultiplier(statuses: readonly ActiveStatus[] = []): number {
  return Math.max(0.3, 1 - Math.min(0.7, statusMagnitude(statuses, 'SLOW')));
}

export function outgoingDamageMultiplier(statuses: readonly ActiveStatus[] = []): number {
  return Math.max(0.35, 1 - Math.min(0.65, statusMagnitude(statuses, 'WEAKNESS')));
}

export function incomingDamageMultiplier(statuses: readonly ActiveStatus[] = []): number {
  return Math.max(0.2, 1 - Math.min(0.8, statusMagnitude(statuses, 'GUARD')));
}

function isDamageOverTime(statusId: string): statusId is 'BLEED' | 'POISON' | 'BURN' {
  return statusId === 'BLEED' || statusId === 'POISON' || statusId === 'BURN';
}
