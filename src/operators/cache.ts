import {ReplaySubject, share, timer} from "rxjs";

/**
 * Cache the last value of the observable
 * Will reset if all subscribers unsubscribe
 */
export function cache<T>() {
  return share<T>({
    connector: () => new ReplaySubject(1, Infinity),
    resetOnError: false,
    resetOnComplete: false,
    resetOnRefCountZero: true
  });
}

/**
 * Cache the last value of the observable
 * Will stay alive without subscribers for the duration specified
 * @param duration - Keep alive duration is ms
 */
export function persistentCache<T>(duration = 1000) {
  return share<T>({
    connector: () => new ReplaySubject(1, Infinity),
    resetOnError: false,
    resetOnComplete: false,
    resetOnRefCountZero: () => timer(duration)
  });
}

/**
 * Cache the last value of the observable
 * Will cache permanently. Will stay alive even with 0 subscribers
 * Complete observable to dispose
 */
export function permanentCache<T>() {
  return share<T>({
    connector: () => new ReplaySubject(1, Infinity),
    resetOnError: false,
    resetOnComplete: false,
    resetOnRefCountZero: false
  });
}
