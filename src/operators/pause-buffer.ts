import {distinctUntilChanged, MonoTypeOperatorFunction, Observable} from "rxjs";

class Completed {
}

class Failed {
  constructor(public error: any) {
  }
}

/**
 * Only emit values when the pauses$ observable has a false value
 * Values caught while paused will be emitted after the pause ends
 * @param paused$ - Pause state
 */
export function pauseBuffer<T>(paused$: Observable<boolean>): MonoTypeOperatorFunction<T> {
  return (source) => {
    return new Observable(subscriber => {

      let completed = false;
      let buffer: (T | Completed | Failed)[] = [];

      let paused = false;
      const pausedSub = paused$.pipe(distinctUntilChanged()).subscribe(
        p => {
          paused = p;
          if (!p) emitBuffer();
        }
      );

      function emitBuffer() {
        const localBuffer = buffer;
        buffer = [];

        for (let element of localBuffer) {

          if (element instanceof Failed) {
            subscriber.error(element.error);
            continue;
          }

          if (element instanceof Completed) {
            subscriber.complete();
            break;
          }

          subscriber.next(element);
        }
      }

      const sub = source.subscribe({
        next(value) {
          if (completed) return;

          if (!paused) {
            subscriber.next(value);
            return;
          }

          buffer.push(value);
        },
        error: error => {
          if (completed) return;

          if (!paused) {
            subscriber.error(error);
            return;
          }

          buffer.push(new Failed(error));
        },
        complete: () => {
          completed = true;

          if (!paused) {
            subscriber.complete();
            return;
          }

          buffer.push(Completed);
        }
      });

      return () => {
        sub.unsubscribe();
        pausedSub.unsubscribe();
      }
    });
  };
}
