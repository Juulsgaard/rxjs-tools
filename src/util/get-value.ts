import {Subscribable, Unsubscribable} from "rxjs";

//<editor-fold desc="Latest Value">
/**
 * Reads a cached value from synchronously resolving observable
 * Often used in conjunction with the cache operator to read the latest cached value
 * Will throw an error if no value can be resolved
 * @param observable
 * @throws Error
 */
export function latestValueFrom<T>(observable: Subscribable<T>): T {
  let hasValue = false;
  let value: T;
  const sub = observable.subscribe({
    next: x => {
      value = x
      hasValue = true;
    },
    error: err => {throw err}
  });
  sub.unsubscribe();
  if (!hasValue) throw Error("Observable does not have a cached value");
  return value!;
}

/**
 * Reads a cached value from synchronously resolving observable.
 * Often used in conjunction with the cache operator to read the latest cached value.
 * @param observable
 * @param defaultValue
 * @return value - Cached value, or given default if none was found
 */
export function latestValueFromOrDefault<T, TDefault>(observable: Subscribable<T>, defaultValue: TDefault): T|TDefault;
/**
 * Reads a cached value from synchronously resolving observable.
 * Often used in conjunction with the cache operator to read the latest cached value.
 * @param observable
 * @return value - Cached value, or undefined if none was found
 */
export function latestValueFromOrDefault<T>(observable?: Subscribable<T>): T|undefined;
export function latestValueFromOrDefault<T, TDefault>(observable?: Subscribable<T>, defaultValue?: TDefault): T|TDefault|undefined {
  if (!observable) return undefined;
  let value: T|TDefault|undefined = defaultValue;
  const sub = observable.subscribe({
    next: x => value = x,
    error: err => {throw err}
  });
  sub.unsubscribe();
  return value;
}
//</editor-fold>

//<editor-fold desc="Subscribable First">
/**
 * Asynchronously get the first value emitted by the Subscribable
 * @param subject - The subscribable
 */
export function firstValueFromSubscribable<T>(subject: Subscribable<T>): Promise<T> {
  return new Promise<T>((_resolve, _reject) => {
    let sub: Unsubscribable|undefined;

    const resolve = (val: T) => {
      sub?.unsubscribe();
      _resolve(val);
    };

    const reject = (val: any) => {
      sub?.unsubscribe();
      _reject(val);
    };

    sub = subject.subscribe({
      next: x => resolve(x),
      error: x => reject(x),
      complete: () => reject(Error("Subscribable never emitted a value"))
    });
  });
}

/**
 * Asynchronously get the first value emitted by the Subscribable.
 * If no value is emitted undefined will be returned
 * @param subject - The subscribable
 */
export function firstValueFromSubscribableOrDefault<T>(subject: Subscribable<T>): Promise<T|undefined>;
/**
 * Asynchronously get the first value emitted by the Subscribable.
 * If no value is emitted or the timout is reached, the default value will be returned instead
 * @param subject - The subscribable
 * @param defaultValue - The default value to use
 * @param timeout - The timeout before the default value is used
 */
export function firstValueFromSubscribableOrDefault<T, TDefault>(subject: Subscribable<T>, defaultValue: TDefault, timeout?: number): Promise<T|TDefault>;
export function firstValueFromSubscribableOrDefault<T, TDefault>(subject: Subscribable<T>, defaultValue?: TDefault, timeout?: number): Promise<T|TDefault|undefined> {
  return new Promise<T | TDefault | undefined>((_resolve, _reject) => {
    let timer: number|undefined;
    let sub: Unsubscribable|undefined;

    const resolve = (val: T|TDefault|undefined) => {
      clearTimeout(timer);
      sub?.unsubscribe();
      _resolve(val);
    };

    const reject = (val: any) => {
      clearTimeout(timer);
      sub?.unsubscribe();
      _reject(val);
    };

    if (timeout) {
      setTimeout(() => resolve(defaultValue), timeout);
    }

    sub = subject.subscribe({
      next: x => resolve(x),
      error: x => reject(x),
      complete: () => resolve(defaultValue)
    });

    if (timeout === 0) {
      resolve(defaultValue);
    }
  });
}
//</editor-fold>
