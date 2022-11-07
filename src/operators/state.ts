import {last, MonoTypeOperatorFunction, Subject, tap} from "rxjs";
import {isFunction} from "@consensus-labs/ts-tools";

/**
 * Projects the subscription state of the observable
 * @param onState - Callback triggered whenever the subscription state changes
 */
export function subscribed<T>(onState: (subscribed: boolean) => void): MonoTypeOperatorFunction<T>
/**
 * Projects the subscription state of the observable
 * @param state$ - A subject that will receive the current subscription state
 */
export function subscribed<T>(state$: Subject<boolean>): MonoTypeOperatorFunction<T>
export function subscribed<T>(state: Subject<boolean>|((subscribed: boolean) => void)): MonoTypeOperatorFunction<T> {
  const setState = isFunction(state) ? state : state.next.bind(state);
  return tap<T>({
   subscribe: () => setState(true),
    finalize: () => setState(false)
  });
}

/**
 * Projects the state of the observable
 * State is true while the observable is active, but hasn't emitted a value
 * @param onState - Callback triggered whenever the state changes
 */
export function loadingFirst<T>(onState: (loadingFirst: boolean) => void): MonoTypeOperatorFunction<T>
/**
 * Projects the state of the observable
 * State is true while the observable is active, but hasn't emitted a value
 * @param state$ - A subject that will receive the current state
 */
export function loadingFirst<T>(state$: Subject<boolean>): MonoTypeOperatorFunction<T>
export function loadingFirst<T>(state: Subject<boolean>|((loadingFirst: boolean) => void)): MonoTypeOperatorFunction<T> {

  const baseSetState = isFunction(state) ? state : state.next.bind(state);

  let lastState = false;
  const setState = (state: boolean) => {
    if (state === lastState) return;
    lastState = state;
    baseSetState(state);
  };

  return tap<T>({
    subscribe: () => setState(true),
    next: () => setState(false),
    finalize: () => setState(false),
  });
}
