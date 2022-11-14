import {MonoTypeOperatorFunction, Observable, OperatorFunction, ReplaySubject, share, switchMap, timer, Unsubscribable} from "rxjs";

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
 * @param releaseOnValue - If true the cache will reset when there are no subscribers and a new value is emitted from the source
 */
export function permanentCache<T>(releaseOnValue = false): MonoTypeOperatorFunction<T> {
  return source => {

    let subject: ReplaySubject<T>|undefined;
    let sub: Unsubscribable|undefined;
    let refCount = 0;

    const getSubject = () => {
      if (subject) return subject;

      subject = new ReplaySubject<T>(1, Infinity);

      sub = source.subscribe({
        next: value => {
          if (!subject) return;
          if (releaseOnValue && refCount < 1) {
            subject = undefined;
            sub?.unsubscribe();
            sub = undefined;
            return;
          }
          subject.next(value);
        },
        error: err => subject?.error(err),
        complete: () => subject?.complete()
      });

      return subject;
    };

    return new Observable(subscriber => {
      refCount++;
      subscriber.add(() => refCount--);
      const subject = getSubject();
      return subject.subscribe(subscriber);
    });
  }
}

/**
 * Experimental cache operator that will release once it has no subscribers.
 * It will still store the latest value, and will emit that old value to new subscribers.
 * If the first source value after reset is the same as the latest, then it will not be re-emitted.
 * The purpose is to have a cache that unsubscribes, but still doesn't re-evaluate unnecessarily
 */
export function uniqueCache<T>(): MonoTypeOperatorFunction<T> {
  return source => {

    let subject = new ReplaySubject<T>(1, Infinity);
    let sub: Unsubscribable|undefined;
    let refCount = 0;
    let hasValue = false;
    let lastValue: T|undefined;

    return new Observable(subscriber => {
      refCount++;

      if (!sub) {
        let first = true;

        sub = source.subscribe({
          next: value => {
            if (first) {
              first = false;
              if (hasValue) {
                if (lastValue === value) return;
              }
            }

            hasValue = true;
            lastValue = value;
            subject.next(value);
          },
          error: err => subject.error(err),
          complete: () => subject.complete()
        });
      }

      const subscription = subject.subscribe(subscriber);

      return () => {
        subscription.unsubscribe();
        refCount--;

        if (refCount === 0) {
          sub?.unsubscribe();
          sub = undefined;
        }
      };
    });
  }
}

/**
 * A method that will map a value to a subscribable type
 * The subscribable will be automatically cached using a ReplaySubject
 * The subscribable is unsubscribed from on unsubscription or when a new value is mapped
 * @param mapFunc - Map the value to a subscribable
 */
function cachedSwitchMap<T, TOut>(mapFunc: (value: T) => Observable<TOut>): OperatorFunction<T, Observable<TOut>> {
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
export function voidableCache<T, TOut>(mapFunc: (value: T) => Observable<TOut>): OperatorFunction<T, TOut> {
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
export function voidablePersistentCache<T, TOut>(mapFunc: (value: T) => Observable<TOut>, duration = 1000): OperatorFunction<T, TOut> {
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
 * @param releaseOnValue - If true the cache will reset when there are no subscribers and a new value is emitted from the source
 */
export function voidablePermanentCache<T, TOut>(mapFunc: (value: T) => Observable<TOut>, releaseOnValue = false): OperatorFunction<T, TOut> {
  return source => source.pipe(
    cachedSwitchMap(x => mapFunc(x)),
    permanentCache(),
    switchMap(x => x));
}
