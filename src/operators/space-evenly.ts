import {asyncScheduler, MonoTypeOperatorFunction, Observable, SchedulerLike, Subscription} from "rxjs";

class Completed {
}

class Failed {
  constructor(public error: any) {
  }
}

/**
 * Will evenly space out values using a buffer
 * @param delay - The min delay to maintain between values in ms
 * @param scheduler - The scheduler
 */
export function spaceEvenly<T>(delay: number, scheduler: SchedulerLike = asyncScheduler): MonoTypeOperatorFunction<T> {
  return (source) => {
    return new Observable(subscriber => {

      let completed = false;
      let timer: Subscription | undefined;
      let lastEmit: number|undefined;
      let buffer: (T | Completed | Failed)[] = [];

      function emit() {
        timer?.unsubscribe();

        if (buffer.length < 1) return;
        const value = buffer.shift();

        if (value instanceof Failed) {
          subscriber.error(value.error);
          tryEmit();
          return;
        }

        if (value instanceof Completed) {
          subscriber.complete();
          return;
        }

        lastEmit = scheduler.now();
        subscriber.next(value);

        timer = undefined;
        tryEmit();
      }

      function tryEmit() {
        if (timer) return;
        if (buffer.length < 1) return;
        if (!lastEmit) {
          emit();
          return;
        }
        const now = scheduler.now();
        const timeSinceEmit = now - lastEmit;
        if (timeSinceEmit >= delay) {
          emit();
          return;
        }

        timer = scheduler.schedule(() => emit(), delay - timeSinceEmit);
      }

      const sub = source.subscribe({
        next(value) {
          if (completed) return;
          buffer.push(value);
          tryEmit();
        },
        error: error => {
          if (completed) return;
          buffer.push(new Failed(error));
          tryEmit();
        },
        complete: () => {
          completed = true;
          buffer.push(Completed);
          tryEmit();
        }
      });

      return () => {
        sub.unsubscribe();
        timer?.unsubscribe();
      }
    });
  };
}
