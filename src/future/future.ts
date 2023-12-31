import {
  BehaviorSubject, combineLatest, Observable, Observer, of, pairwise, Subscribable, Subscription, switchMap, take,
  Unsubscribable
} from "rxjs";
import {distinctUntilChanged, filter, first, map} from "rxjs/operators";
import {FutureConfig} from "./future-config";
import {FutureEmpty, FutureError, FutureLoading, FutureUnion, FutureValue} from "./future-types";
import {cache} from "../operators/cache";
import {IValueLoadingState} from "../loading-state/value-loading-state.interface";

export class Future<T> implements Subscribable<FutureUnion<T>> {

  /**
   * Generate a new Future using a config
   * @param value$ - Values
   * @param loading$ - The loading state
   * @param error$ - The error state
   * @constructor
   */
  static Configure<T>(
    value$: Observable<T>,
    loading$?: Observable<boolean>,
    error$?: Observable<boolean | Error | string | undefined>
  ): FutureConfig<T, T> {
    return new FutureConfig<T, T>(
      value$,
      loading$ ?? of(false),
      error$ ?? of(new Error()),
      x => x ?? undefined
    );
  }

  /**
   * Create a Future
   * @param value$ - Values
   * @param loading$ - The loading state
   * @param error$ - The error state
   * @constructor
   */
  static Create<T>(
    value$: Observable<T | undefined>,
    loading$?: Observable<boolean>,
    error$?: Observable<Error | boolean | string | undefined>,
  ): Future<NonNullable<T>> {
    return new Future<NonNullable<T>>(
      value$ as Observable<NonNullable<T> | undefined>,
      loading$ ?? of(false),
      error$ ?? of(new Error()),
    );
  }

  /**
   * Create an empty Future
   * @constructor
   */
  static Empty(): Future<any> {
    return new Future<any>(of(undefined), of(false), of(false));
  }

  /**
   * Create a Future from an Observable
   * @param req
   * @constructor
   */
  static FromRequest<T>(req: Observable<T>): Future<T> {
    const val$ = new BehaviorSubject<T | undefined>(undefined);
    const err$ = new BehaviorSubject<Error | undefined>(undefined);
    const load$ = new BehaviorSubject(true);
    req.subscribe({
      next: x => val$.next(x),
      error: err => {
        err$.next(err);
        err$.complete();
        load$.next(false);
        load$.complete();
        val$.complete();
      },
      complete: () => {
        val$.complete();
        err$.complete();
        load$.next(false);
        load$.complete();
      }
    });
    return new Future<T>(val$, load$, err$);
  }

  /**
   * Create a Future from a LoadingState
   * @param loading
   * @constructor
   */
  static FromLoadingState<T>(loading: IValueLoadingState<T>): Future<T> {
    return new Future<T>(
      loading.result$,
      loading.loading$,
      loading.failed$.pipe(switchMap(failed => failed ? loading.error$ : of(undefined)))
    );
  }

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
