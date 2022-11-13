import {Observable, OperatorFunction, ReplaySubject, share, Subscribable, switchMap, timer, Unsubscribable} from "rxjs";

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
 * A method that will map a value to a subscribable type
 * The subscribable will be automatically cached using a ReplaySubject
 * The subscribable is unsubscribed from on unsubscription or when a new value is mapped
 * @param mapFunc - Map the value to a subscribable
 */
function cachedSwitchMap<T, TOut>(mapFunc: (value: T) => Subscribable<TOut>): OperatorFunction<T, Observable<TOut>> {
  return source => new Observable(subscriber => {
    let subscription: Unsubscribable|undefined;
    const sub = source.subscribe({
      next: x => {
        subscription?.unsubscribe();
        const subject = new ReplaySubject<TOut>();
        subscription = mapFunc(x).subscribe(subject);
        subscriber.next(subject);
      },
      error: x => subscriber.error(x),
      complete: () => subscriber.complete()
    });

    return () => {
      sub.unsubscribe();
      subscription?.unsubscribe();
    };
  });
}

/**
 * Cache the last value of the observable
 * Will reset if all subscribers unsubscribe
 * Every new value voids the observable until a value is emitted from the mapped observable
 * @param mapFunc - Function to generate an observable which populates the main observable after being voided
 */
export function voidableCache<T, TOut>(mapFunc: (value: T) => Subscribable<TOut>): OperatorFunction<T, TOut> {
  return source => source.pipe(
    cachedSwitchMap(x => mapFunc(x)),
    cache(),
    switchMap(x => x)
  );
}

/**
 * Cache the last value of the observable
 * Will stay alive without subscribers for the duration specified
 * Every new value voids the observable until a value is emitted from the mapped observable
 * @param mapFunc - Function to generate an observable which populates the main observable after being voided
 * @param duration - Keep alive duration is ms
 */
export function voidablePersistentCache<T, TOut>(mapFunc: (value: T) => Subscribable<TOut>, duration = 1000): OperatorFunction<T, TOut> {
  return source => source.pipe(
    cachedSwitchMap(x => mapFunc(x)),
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
export function voidablePermanentCache<T, TOut>(mapFunc: (value: T) => Subscribable<TOut>): OperatorFunction<T, TOut> {
  return source => source.pipe(
    cachedSwitchMap(x => mapFunc(x)),
    permanentCache(),
    switchMap(x => x));
}
