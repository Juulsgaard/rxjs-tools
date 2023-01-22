import {Observable, Observer, Subscribable, Unsubscribable} from "rxjs";

/**
 * The base loading state
 */
export abstract class ILoadingState implements Subscribable<boolean> {

  /** Indicates the loading state of the command */
  readonly abstract loading$: Observable<boolean>;
  /** Emits an error if one occurs */
  readonly abstract error$: Observable<any>;
  /** Indicates if the actions has failed */
  readonly abstract failed$: Observable<any>;
  /** Indicates the loading state of the command */
  readonly abstract loading: boolean;
  /** Indicates if the action was async or not */
  readonly abstract isAsync: boolean;

  /**
   * Cancels the actions
   * If the action was in progress, an error will be emitted
   */
  abstract cancel(): void;

  /**
   * Subscribe to the loading state
   * @param observer
   */
  subscribe(observer: Partial<Observer<boolean>>): Unsubscribable {
    return this.loading$.subscribe(observer);
  }
}

