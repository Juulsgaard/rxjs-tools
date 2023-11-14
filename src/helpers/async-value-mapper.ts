import {Disposable} from "@juulsgaard/ts-tools";
import {from, Observable, Observer, Subject, Subscribable, Unsubscribable} from "rxjs";
import {isSubscribable} from "../util/type-guards";

export type AsyncVal<T> = Subscribable<T> | Observable<T> | Promise<T>;
export type AsyncOrSyncVal<T> = AsyncVal<T> | T;

// TODO: Switch back to clean implementation when Angular templates can handle it
// export type UnwrappedAsyncVal<T extends AsyncVal<unknown>, TMod = never> =
//   T extends Subscribable<infer U> ? U | TMod :
//     T extends Observable<infer U> ? U | TMod :
//       T extends Promise<infer U> ? U | TMod :
//         never;

// TODO: Switch back to clean implementation when Angular templates can handle it
// type UnwrappedAsyncOrSyncVal<T, TMod = never> =
//   T extends Subscribable<infer U> ? U | TMod :
//     T extends Observable<infer U> ? U | TMod :
//       T extends Promise<infer U> ? U | TMod :
//         T;

export type UnwrappedAsyncVal<T extends AsyncVal<unknown>, TMod = never> =
  UnwrapSubscribable<T, UnwrapObservable<T, UnwrapPromise<T, never, TMod>, TMod>, TMod>;

export type UnwrappedAsyncOrSyncVal<T, TMod = never> =
  UnwrapSubscribable<T, UnwrapObservable<T, UnwrapPromise<T, T, TMod>, TMod>, TMod>;

//<editor-fold desc="Temp Unwrap Helpers">
type UnwrapSubscribable<T, TElse = never, TMod = never> =
  T extends Subscribable<unknown> ?
    T["subscribe"] extends (observer: infer U) => Unsubscribable ?
      U extends Partial<Observer<any>> ?
        U["next"] extends ((value: infer O) => void) | undefined ? O | TMod
          : TElse
        : TElse
      : TElse
    : TElse;

type UnwrapObservable<T, TElse = never, TMod = never> = T extends Observable<infer U> ? U | TMod : TElse;
type UnwrapPromise<T, TElse = never, TMod = never> = T extends Promise<infer U> ? U | TMod : TElse;
//</editor-fold>

abstract class BaseAsyncValueMapper<T> implements Disposable {

  private sub?: Unsubscribable;
  private disposed = false;

  private readonly _value$ = new Subject<T>();
  public readonly value$ = this._value$.asObservable();

  private readonly _error$ = new Subject<void>();
  public readonly error$ = this._error$.asObservable();

  constructor(private onValue?: (value: T) => void, private onError?: () => void) {
  }

  protected setValue(value: T) {
    this._value$.next(value);
    this.onValue?.(value);
  }

  protected setError() {
    this._error$.next();
    this.onError?.();
  }

  /**
   * Update the mapper with a new input value
   * @param value
   * @returns emitted - True is a value was synchronously emitted
   */
  update(value: AsyncOrSyncVal<T>) {
    if (this.disposed) return;
    this.sub?.unsubscribe();

    if (value instanceof Promise) {
      value = from(value);
    }

    if (value instanceof Observable || isSubscribable(value)) {
      let emitted = false;
      const sub = this.value$.subscribe(() => emitted = true);
      this.sub = this.mapObservable(value);
      sub.unsubscribe();
      return emitted;
    }

    this.setValue(value);
    return true;
  }

  abstract mapObservable(value$: Subscribable<T>): Unsubscribable;

  reset() {
    this.sub?.unsubscribe();
  }

  dispose() {
    this.reset();
    this.disposed = true;
  }
}

export class AsyncValueMapper<T> extends BaseAsyncValueMapper<T> {

  mapObservable(value$: Subscribable<T>): Unsubscribable {
    return value$.subscribe({
      next: x => this.setValue(x),
      error: () => this.setError()
    });
  }

}

export class AsyncValueFallbackMapper<T, TFallback> extends BaseAsyncValueMapper<T|TFallback> {


  constructor(private fallback: TFallback, onValue?: (value: T|TFallback) => void, onError?: () => void) {
    super(onValue, onError);
  }

  mapObservable(value$: Subscribable<T>): Unsubscribable {
    let emitted = false;

    const sub = value$.subscribe({
      next: x => {
        if (!emitted) emitted = true;
        this.setValue(x)
      },
      error: () => {
        this.setError()
      }
    });

    if (!emitted) this.setValue(this.fallback);

    return sub;
  }

}
