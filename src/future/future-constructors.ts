import {BehaviorSubject, Observable, of, Subscribable, switchMap} from "rxjs";
import {Future} from "./future";
import {FutureConfig} from "./future-config";
import {IValueLoadingState} from "../loading-state/value-loading-state.interface";
import {parseError} from "@juulsgaard/ts-tools";

/**
 * Create a Future
 * @param value$ - Values
 * @param loading$ - The loading state
 * @param error$ - The error state
 * @constructor
 * @category Future
 */
function createFuture<T>(
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
 * Generate a new Future using a config
 * @param value$ - Values
 * @param loading$ - The loading state
 * @param error$ - The error state
 * @constructor
 * @category Future
 */
function configureFuture<T>(
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
 * Create an empty Future
 * @constructor
 * @category Future
 */
function emptyFuture(): Future<any> {
  return new Future<any>(of(undefined), of(false), of(false));
}

/**
 * Create a Future from an Observable
 * @param req
 * @constructor
 * @category Future
 */
function futureFromRequest<T>(req: Observable<T>): Future<T> {
  const val$ = new BehaviorSubject<T | undefined>(undefined);
  const err$ = new BehaviorSubject<Error | undefined>(undefined);
  const load$ = new BehaviorSubject(true);
  req.subscribe({
    next: x => val$.next(x),
    error: err => {
      err$.next(parseError(err));
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
 * @category Future
 */
function futureFromLoadingState<T>(loading: IValueLoadingState<T>): Future<T> {
  return new Future<T>(
    loading.result$,
    loading.loading$,
    loading.failed$.pipe(switchMap(failed => failed ? loading.error$ : of(undefined)))
  );
}

/**
 * Create a Future from a Observable / Subscribable.
 * Will resolve on the first emitted value
 * @param value$
 * @constructor
 * @category Future
 */
function futureFromObservable<T>(value$: Subscribable<T>): Future<T> {
  const val$ = new BehaviorSubject<T | undefined>(undefined);
  const err$ = new BehaviorSubject<Error | undefined>(undefined);
  const load$ = new BehaviorSubject(true);
  const sub = value$.subscribe({
    next: x => {
      sub.unsubscribe();
      val$.next(x);
      val$.complete();
      err$.complete();
      load$.next(false);
      load$.complete();
    },
    error: err => {
      err$.next(parseError(err));
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

/** All available Future constructors */
type FutureConstructor = typeof createFuture & {
  readonly configure: typeof configureFuture;
  readonly empty: typeof emptyFuture;
  readonly fromRequest: typeof futureFromRequest;
  readonly fromLoadingState: typeof futureFromLoadingState;
  readonly fromObservable: typeof futureFromObservable;
};

type Mutable = {
  -readonly [K in keyof FutureConstructor]: FutureConstructor[K]
}

const constructor = createFuture as typeof createFuture & Mutable;

constructor.configure = configureFuture;
constructor.empty = emptyFuture;
constructor.fromRequest = futureFromRequest;
constructor.fromLoadingState = futureFromLoadingState;
constructor.fromObservable = futureFromObservable;

/**
 * Create a Future
 * @category Future
 */
export const future: FutureConstructor = constructor;
