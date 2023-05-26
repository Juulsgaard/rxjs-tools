import {MonoTypeOperatorFunction, Observable} from "rxjs";
import {Disposable} from "@consensus-labs/ts-tools";

/**
 * Will dispose any value when a new one is emitted or the observable is unsubscribed from
 */
export function disposable<T extends Disposable>(): MonoTypeOperatorFunction<T> {
  return source => new Observable(subscriber => {

    let oldValue: Disposable|undefined;

    const sub = source.subscribe({
      next: val => {
        oldValue?.dispose();
        oldValue = val;
        subscriber.next(val);
      },
      error: subscriber.error,
      complete: subscriber.complete
    });

    return () => {
      oldValue?.dispose();
      sub.unsubscribe();
    };
  })
}
