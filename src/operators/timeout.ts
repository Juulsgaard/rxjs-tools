import {MonoTypeOperatorFunction, Observable, of, OperatorFunction, throwError, timeout} from "rxjs";

/**
 * If no value is emitted before the duration runs out, emit the default value
 * @param duration - Timeout in ms
 * @param defaultVal - The default value
 */
export function timeoutDefault<T, TVal>(duration: number, defaultVal: TVal): OperatorFunction<T, T|TVal> {
  return (obs: Observable<T>) => obs.pipe(timeout({
    first: duration,
    with: () => of(defaultVal)
  }));
}

/**
 * If no value is emitted before the duration runs out, throw and exception
 * @param duration - Timeout in ms
 * @param error - The error
 */
export function timeoutError<T, TError extends Error>(duration: number, error: () => TError): MonoTypeOperatorFunction<T> {
  return (obs: Observable<T>) => obs.pipe(timeout({
    first: duration,
    with: () => throwError(error)
  }));
}
