import {Observable, of, OperatorFunction, ReplaySubject, share, switchMap, timer} from "rxjs";
import {map} from "rxjs/operators";

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

/**
 * Cache the last value of the observable
 * Will reset if all subscribers unsubscribe
 * Every new value voids the observable until a value is emitted from the mapped observable
 * @param mapFunc - Function to generate an observable which populates the main observable after being voided
 */
export function voidableCache<T, TOut>(mapFunc: ($: Observable<T>) => Observable<TOut>): OperatorFunction<T, TOut> {
  return source => source.pipe(
    map(x => mapFunc(of(x)).pipe(permanentCache())),
    cache(),
    switchMap(x => x));
}

/**
 * Cache the last value of the observable
 * Will stay alive without subscribers for the duration specified
 * Every new value voids the observable until a value is emitted from the mapped observable
 * @param mapFunc - Function to generate an observable which populates the main observable after being voided
 * @param duration - Keep alive duration is ms
 */
export function voidablePersistentCache<T, TOut>(mapFunc: ($: Observable<T>) => Observable<TOut>, duration = 1000): OperatorFunction<T, TOut> {
  return source => source.pipe(
    map(x => mapFunc(of(x)).pipe(permanentCache())),
    persistentCache(duration),
    switchMap(x => x));
}

/**
 * Cache the last value of the observable
 * Will cache permanently. Will stay alive even with 0 subscribers
 * Complete observable to dispose
 * Every new value voids the observable until a value is emitted from the mapped observable
 * @param mapFunc - Function to generate an observable which populates the main observable after being voided
 */
export function voidablePermanentCache<T, TOut>(mapFunc: ($: Observable<T>) => Observable<TOut>): OperatorFunction<T, TOut> {
  return source => source.pipe(
    map(x => mapFunc(of(x)).pipe(permanentCache())),
    permanentCache(),
    switchMap(x => x));
}
