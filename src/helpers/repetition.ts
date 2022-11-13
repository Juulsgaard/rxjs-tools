import {asyncScheduler, Observable, SchedulerLike, Unsubscribable} from "rxjs";

type Duration<T> = number|((value: T) => number);

/**
 * Create an
 * @param action
 * @param duration
 * @param scheduler
 */
export function repeatOnComplete<TOut>(action: () => Observable<TOut>, duration = 0, scheduler: SchedulerLike = asyncScheduler): Observable<TOut> {
  return baseRepeatOnComplete(action, duration, false, scheduler);
}

export function repeatOnCompleteWithValue<TOut>(action: () => Observable<TOut>, duration: Duration<TOut> = 0, scheduler: SchedulerLike = asyncScheduler): Observable<TOut> {
  return baseRepeatOnComplete(action, duration, true, scheduler);
}

function baseRepeatOnComplete<TOut>(action: () => Observable<TOut>, duration: Duration<TOut>, requireValue: boolean, scheduler: SchedulerLike): Observable<TOut> {
  return new Observable(subscriber => {

    let timer: Unsubscribable|undefined;
    let actionSub: Unsubscribable|undefined;

    const startRequest = () => {
      timer?.unsubscribe();
      actionSub?.unsubscribe();

      let emittedValue = false;
      let latestVal: TOut|undefined;

      actionSub = action().subscribe({
        next: value => {
          emittedValue = true;
          latestVal = value;
          subscriber.next(value)
        },
        error: err => subscriber.error(err),
        complete: () => {
          if (requireValue && !emittedValue) {
            subscriber.complete();
            return;
          }

          const delay = typeof duration === 'number' ? duration : duration(latestVal as TOut);
          timer = scheduler.schedule(() => startRequest(), delay);
        }
      });
    };

    startRequest();

    return () => {
      actionSub?.unsubscribe();
      timer?.unsubscribe();
    }
  });
}
