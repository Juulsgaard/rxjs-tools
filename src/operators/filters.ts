import {MonoTypeOperatorFunction, Observable, OperatorFunction} from "rxjs";
import {filter} from "rxjs/operators";

export function notNull<T>(): OperatorFunction<T, NonNullable<T>> {
  return source => source.pipe(filter((value): value is NonNullable<T> => value != undefined));
}

/**
 * Filter out synchronously emitted values
 */
export function notSync<T>(): MonoTypeOperatorFunction<T> {
  return source => new Observable(subscriber => {
    let init = true;
    const sub = source.pipe(filter(() => !init)).subscribe(subscriber);
    init = false;
  });
}
