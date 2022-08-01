import {Observable} from "rxjs";

/**
 * Reads a cached value from synchronously resolving observable
 * Often used in conjunction with the cache operator to read the latest cached value
 * Will throw an error if no value can be resolved
 * @param observable
 * @throws Error
 */
export function latestValueFrom<T>(observable: Observable<T>): T {
  let hasValue = false;
  let value: T;
  const sub = observable.subscribe(x => {
    value = x
    hasValue = true;
  });
  sub.unsubscribe();
  if (!hasValue) throw Error("Observable does not have a cached value");
  return value!;
}

/**
 * Reads a cached value from synchronously resolving observable
 * Often used in conjunction with the cache operator to read the latest cached value
 * @param observable
 * @return value - Cached value, or undefined if none was found
 */
export function latestValueFromOrDefault<T>(observable?: Observable<T>): T|undefined {
  if (!observable) return undefined;
  let value: T|undefined = undefined;
  const sub = observable.subscribe(x => value = x);
  sub.unsubscribe();
  return value;
}
