import {
  combineLatest, Observable, Observer, of, pairwise, Subscribable, Subscription, switchMap, take, Unsubscribable
} from "rxjs";
import {distinctUntilChanged, filter, first, map} from "rxjs/operators";
import {FutureEmpty, FutureError, FutureLoading, FutureUnion, FutureValue} from "./future-types";
import {cache} from "../operators/cache";

/**
 * A class for handling dynamic values and tracking an error / loading state.
 * Unlike a LoadingState this structure handles values that change, and can re-enter the loading state.
 * @category Future
 */
export class Future<T> implements Subscribable<FutureUnion<T>> {

  /** The state of the Future */
  state$: Observable<FutureUnion<T>>;

  /** Indicates if the future is in a state where the underlying request can be executed */
  canLoad$: Observable<boolean>;

  /** The value of the Future. Won't emit until a value is present */
  value$: Observable<T>;
  /** The value of the Future if one is currently given, otherwise undefined */
  rawValue$: Observable<T | undefined>;

  /** The value of Future if the future is in the Data state, otherwise undefined */
  data$: Observable<T | undefined>;
  /** True if the Future is in the Loading state, otherwise false */
  loading$: Observable<boolean>;
  /** True if the Future is in the Loading or Empty state, otherwise false */
  waiting$: Observable<boolean>;
  /** True if the Future is in the Empty state, otherwise false */
  empty$: Observable<boolean>;
  /** True if the Future is in the Error state, otherwise false */
  failed$: Observable<boolean>;
  /** The error given if the Future is in the Error state, otherwise undefined */
  error$: Observable<Error | undefined>;

  constructor(
    value$: Observable<T | undefined>,
    loading$: Observable<boolean>,
    error$: Observable<Error | boolean | string | undefined>,
    onLoad?: () => void,
    onDeleted?: () => void,
  ) {

    this.rawValue$ = value$.pipe(
      // persistentCache(),
      cache()
    );

    this.value$ = this.rawValue$.pipe(
      filter((x): x is T => x !== undefined),
      distinctUntilChanged()
    );

    // Create instance for easier change detection
    const emptyError = new Error();

    const errors$ = error$?.pipe(map(error => {
      if (!error) return undefined;
      if (error === true) return emptyError;
      if (error instanceof Error) return error;
      return new Error(error);
    })) ?? of(undefined);

    // Get combined state
    let combined = combineLatest([this.rawValue$, loading$, errors$]).pipe(
      distinctUntilChanged(
        ([oldVal, oldLoading, oldError], [val, loading, error]) => oldVal === val && oldLoading === loading && oldError === error
      ),
      cache()
    );

    this.canLoad$ = combined.pipe(
      map(([value, loading]) => !value && !loading)
    );

    this.state$ = new Observable<FutureUnion<NonNullable<T>>>(subscriber => {

      const sub = new Subscription();

      // Map future state
      sub.add(combined.pipe(
        map(([value, loading, error]) => {
          if (loading) return new FutureLoading(value ?? undefined);
          if (error) return new FutureError(error, value ?? undefined);
          if (value === undefined) return new FutureEmpty();
          return new FutureValue(value!);
        }),
        distinctUntilChanged((a, b) => !Future.stateChanged(a, b)),
      ).subscribe(subscriber));

      //<editor-fold desc="Load Event">

      // Emit load event first time the request isn't loading, if it doesn't have a value
      if (onLoad) {

        sub.add(combined.pipe(
          first(([_, loading]) => !loading),
          filter(([val]) => !val),
        ).subscribe(() => onLoad()));

      }
      //</editor-fold>

      //<editor-fold desc="Delete Event">

      // Emit delete event if value is removed, but only after it's no longer loading
      if (onDeleted) {

        sub.add(combined.pipe(
          distinctUntilChanged(([oldVal], [newVal]) => oldVal !== newVal),
          pairwise(),

          // If value has been removed
          filter(([[oldVal], [newVal]]) => oldVal !== undefined && newVal === undefined),

          // Wait for loading to end
          switchMap(() => combined.pipe(
            filter(([_, loading]) => !loading),
            take(1)
          )),

          // If value still isn't present
          filter(([val]) => !val)
        ).subscribe(() => onDeleted?.()));
      }
      //</editor-fold>

      return sub;

    }).pipe(cache());

    this.data$ = this.state$.pipe(map(x => x instanceof FutureValue ? x.value : undefined));
    this.loading$ = this.state$.pipe(map(x => x instanceof FutureLoading));
    this.empty$ = this.state$.pipe(map(x => x instanceof FutureEmpty));
    this.waiting$ = this.state$.pipe(map(x => x instanceof FutureLoading || x instanceof FutureEmpty));
    this.failed$ = this.state$.pipe(map(x => x instanceof FutureError));
    this.error$ = this.state$.pipe(map(x => x instanceof FutureError ? x.error ?? new Error() : undefined));
  }

  /**
   * Change detection for future state
   * @param oldState
   * @param newState
   * @private
   */
  private static stateChanged<T>(oldState: FutureUnion<T>, newState: FutureUnion<T>) {

    if (newState instanceof FutureEmpty) {
      return oldState !== FutureEmpty;
    }

    if (newState instanceof FutureValue) {
      if (oldState instanceof FutureValue) {
        return oldState.value !== newState.value
      }
      return true;
    }

    if (newState instanceof FutureLoading) {
      if (oldState instanceof FutureLoading) {
        return oldState.value !== newState.value
      }
      return true;
    }

    if (newState instanceof FutureError) {
      if (oldState instanceof FutureError) {
        return oldState.error !== newState.error || oldState.value !== newState.value
      }
      return true;
    }

    return oldState !== newState;
  }

  subscribe(observer: Partial<Observer<FutureUnion<T>>>): Unsubscribable {
    return this.state$.subscribe(observer);
  }
}
