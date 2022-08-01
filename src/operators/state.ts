import {MonoTypeOperatorFunction, Subject, tap} from "rxjs";
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
