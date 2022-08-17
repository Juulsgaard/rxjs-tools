import {asyncScheduler, MonoTypeOperatorFunction, Observable, SchedulerLike, Subscriber, Subscription, Unsubscribable} from "rxjs";

class Completed {
}

const completed = new Completed();

class Empty {
}

const empty = new Empty();

class Failed {
  constructor(public error: any) {
  }
}

class Value<T> {
  constructor(public value: T) {
  }
}

type Union<T> = Completed | Empty | Failed | Value<T>;

/**
 * Will evenly space out values using a buffer
 * @param delay - The min delay to maintain between values in ms
 * @param scheduler - The scheduler
 */
export function spaceEvenly<T>(delay: number, scheduler: SchedulerLike = asyncScheduler): MonoTypeOperatorFunction<T> {
  return (source) => {
    return new Observable(subscriber => {

      const queue: Union<T>[] = [];
      const emitter = new TimedEmitter(subscriber, delay, () => queue.length > 0, () => {
        if (queue.length > 0) return new Value(queue.shift());
        return empty;
      }, scheduler);

      const sub = source.subscribe({
        next(value) {
          queue.push(value);
          emitter.emit();
        },
        error: error => {
          queue.push(new Failed(error));
          emitter.emit();
        },
        complete: () => {
          queue.push(completed);
          emitter.emit();
        }
      });

      return () => {
        sub.unsubscribe();
        emitter?.unsubscribe();
      }
    });
  };
}

/**
 * Will evenly space out values using a buffer.
 * If no values are available in the buffer, a value will be pulled from the value history.
 * History will only be used if more than `minHistory` values have been processed
 * @param delay - The min delay to maintain between values in ms
 * @param maxHistory - The maximum amount of entries to keep in memory
 * @param minHistory - The minimum amount of entries before history will be used
 * @param initialHistory - Pre-populate the history of the queue
 * @param scheduler - The scheduler
 */
export function spaceEvenlyRepeat<T>(delay: number, maxHistory = 100, minHistory = 1, initialHistory: T[] = [], scheduler: SchedulerLike = asyncScheduler): MonoTypeOperatorFunction<T> {
  maxHistory = Math.max(0, maxHistory);
  minHistory = Math.max(1,  Math.min(maxHistory, minHistory));

  if (initialHistory.length > maxHistory) {
    initialHistory = initialHistory.slice(-maxHistory);
  }

  return (source) => {
    return new Observable(subscriber => {

      const queue: (T | Completed | Failed)[] = [];

      let history: T[] = [];
      let futureHistory: T[] = initialHistory;

      function getValue(): Union<T> {
        // If value is queued, return it
        if (queue.length > 0) return new Value(queue.shift());

        // If history is empty try loading future history
        if (history.length < 1) {
          if (futureHistory.length < minHistory) return empty;
          history = futureHistory;
          futureHistory = [];
        }

        // Return next history value
        return new Value(history.shift());
      }

      const emitter = new TimedEmitter(
        subscriber,
        delay,
        () => {
          if (queue.length > 0) return true;
          if (history.length > 0) return true;
          return futureHistory.length >= minHistory;
        },
        () => {
          const value = getValue();

          // Save generated values to future history
          if (maxHistory > 0 && value instanceof Value) {
            futureHistory.push(value.value);
            if (futureHistory.length > maxHistory) futureHistory.shift();
          }

          return value;
        },
        scheduler
      );

      const sub = source.subscribe({
        next(value) {
          queue.push(value);
          emitter.emit();
        },
        error: error => {
          queue.push(new Failed(error));
          emitter.emit();
        },
        complete: () => {
          queue.push(completed);
          emitter.emit();
        }
      });

      return () => {
        sub.unsubscribe();
        emitter?.unsubscribe();
      }
    });
  };
}

class TimedEmitter<T> implements Unsubscribable {

  private timer: Subscription | undefined;
  private lastEmit: number | undefined;

  constructor(
    private subscriber: Subscriber<T>,
    private delay: number,
    private hasValue: () => boolean,
    private getValue: () => Union<T>,
    private scheduler: SchedulerLike = asyncScheduler
  ) {
  }

  private emitInternal() {
    this.timer?.unsubscribe();

    const value = this.getValue();

    if (value instanceof Empty) return;

    if (value instanceof Failed) {
      this.subscriber.error(value.error);
      this.emit();
      return;
    }

    if (value instanceof Completed) {
      this.subscriber.complete();
      return;
    }

    this.lastEmit = this.scheduler.now();
    this.subscriber.next(value.value);

    this.timer = undefined;
    this.emit();
  }

  emit() {
    if (this.timer) return;

    if (!this.hasValue()) return;

    if (!this.lastEmit) {
      this.emitInternal();
      return;
    }

    const now = this.scheduler.now();
    const timeSinceEmit = now - this.lastEmit;

    if (timeSinceEmit >= this.delay) {
      this.emitInternal();
      return;
    }

    this.timer = this.scheduler.schedule(() => this.emitInternal(), this.delay - timeSinceEmit);
  }

  unsubscribe(): void {
    this.timer?.unsubscribe();
  }
}
