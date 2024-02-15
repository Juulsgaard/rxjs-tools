import {isObservable, Observable, Subscribable} from "rxjs";
import {DelayedLoadingState} from "./delayed-loading-state";
import {ILoadingState} from "./loading-state.interface";
import {EmptyLoadingState} from "./empty-loading-state";
import {IValueLoadingState} from "./value-loading-state.interface";
import {LoadingState} from "./loading-state";
import {StaticLoadingState} from "./static-loading-state";
import {ErrorLoadingState, ValueErrorLoadingState} from "./error-loading-state";
import {isFunction} from "@juulsgaard/ts-tools";

export module Loading {

  /**
   * Create a Loading State based on an async operation
   * @param value$ - The async operation
   * @constructor
   */
  export function Async<TData>(value$: Promise<TData> | Observable<TData> | Subscribable<TData>): LoadingState<TData> {
    return new LoadingState<TData>(value$);
  }

  /**
   * Create a Loading State based on an async operation
   * @param value$ - The async operation
   * @constructor
   */
  export function Any<TData>(value$: Promise<TData> | Observable<TData> | Subscribable<TData>): LoadingState<TData>;
  /**
   * Creates loading state with a static value
   * @constructor
   */
  export function Any<TData>(value: TData): StaticLoadingState<TData>;
  export function Any<TData>(value$: Promise<TData> | Observable<TData> | TData): IValueLoadingState<TData> {
    if (isObservable(value$) || value$ instanceof Promise) {
      return new LoadingState(value$);
    }

    return new StaticLoadingState(value$);
  }

  /**
   * Create a delayed loading state that won't start loading before triggered
   * @param action - The action that starts the operation
   * @param modify - Modifications to apply to the result
   * @constructor
   */
  export function Delayed<TData>(
    action: () => Promise<TData> | Observable<TData> | TData,
    modify?: (data: TData) => TData | void
  ): DelayedLoadingState<TData> {
    return new DelayedLoadingState<TData>(action, modify);
  }

  /**
   * Generate a state representing an error
   * @param error - A generator for the error to emit
   * @constructor
   */
  export function FromError<TVal>(error: () => Error): IValueLoadingState<TVal>;
  /**
   * Generate a state representing an error
   * @param error - The error to emit
   * @constructor
   */
  export function FromError(error: Error): ILoadingState;
  export function FromError(error: Error|(() => Error)): ILoadingState {
    if (isFunction(error)) return new ValueErrorLoadingState(error);
    return new ErrorLoadingState(error);
  }

  /**
   * Creates an empty / typeless Loading State placeholder
   * @constructor
   */
  export function Empty(): ILoadingState {
    return new EmptyLoadingState();
  }

  /**
   * Creates loading state with a static value
   * @constructor
   */
  export function Static<T>(value: T): IValueLoadingState<T> {
    return new StaticLoadingState(value);
  }
}
