import {delay, MonoTypeOperatorFunction, Observable, of, switchMap} from "rxjs";

export function deferWhen<T>(shouldDefer: () => boolean): MonoTypeOperatorFunction<T> {
  return source => source.pipe(
    switchMap(val => shouldDefer() ? of(val).pipe(delay(0)) : of(val))
  );
}

export function deferSync<T>(): MonoTypeOperatorFunction<T> {
  return source => new Observable(subscriber => {
    let init = true;
    const sub = source.pipe(deferWhen(() => init)).subscribe(subscriber);
    init = false;
  });
}
