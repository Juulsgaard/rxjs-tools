import {BehaviorSubject, lastValueFrom, Observable, ReplaySubject, startWith, Subscribable, Unsubscribable} from "rxjs";
import {map} from "rxjs/operators";
import {parseError} from "@juulsgaard/ts-tools";
import {permanentCache} from "../operators/cache";
import {CancelledError} from "./cancelled.error";
import {IValueLoadingState} from "./value-loading-state.interface";

/**
 * Represents the loading state of a Command
 */
export class LoadingState<TData> extends IValueLoadingState<TData> {

  /** A subscription from binding Observable data */
  private subscription?: Unsubscribable;


  private _loading$ = new BehaviorSubject(true);

  /** @inheritDoc */
  readonly loading$: Observable<boolean>;

  /** @inheritDoc */
  get loading() {
    return this._loading$.value
  }
  /** @inheritDoc */
  error$: Observable<Error>;

  /** @inheritDoc */
  failed$: Observable<boolean>;

  /** The internal result state */
  private _result$ = new ReplaySubject<TData>(1);

  /** @inheritDoc */
  readonly result$: Observable<TData>;


  private _asyncResult?: Promise<TData>;

  /** A promise returning the data once resolved */
  get resultAsync(): Promise<TData> {
    if (this._asyncResult) return this._asyncResult;
    this._asyncResult = lastValueFrom(this.result$);
    return this._asyncResult;
  }

  /** @inheritDoc */
  readonly isAsync = true;

  constructor(data: Promise<TData> | Observable<TData> | Subscribable<TData>) {
    super();

    this.result$ = this._result$.asObservable();
    this.loading$ = this._loading$.asObservable();

    // Filter out errors
    this.error$ = new Observable<Error>(subscriber => {
      this.result$.subscribe({
        error: err => {
          subscriber.next(err); // Already parsed into Error
          subscriber.complete();
        },
        complete: () => subscriber.complete()
      })
    }).pipe(permanentCache());

    this.failed$ = this.error$.pipe(
      map(() => true),
      startWith(false)
    ).pipe(permanentCache());

    if (data instanceof Promise) {
      data.then(
        val => this.setValue(val),
        error => this.setError(error)
      );
      return;
    }

    this.subscription = data.subscribe({
      next: val => this.setValue(val),
      error: error => this.setError(error),
      complete: () => this.setError('Observable completed without value')
    });
  }

  /**
   * Set the value of the state
   * @param val
   * @private
   */
  private setValue(val: TData) {
    this._result$.next(val);
    this._result$.complete();
    this._loading$.next(false)
    this._loading$.complete();
    this.subscription?.unsubscribe();
  }

  /**
   * Emit an error
   * @param error
   * @private
   */
  private setError(error: any) {
    this._result$.error(parseError(error));
    this._result$.complete();
    this._loading$.next(false)
    this._loading$.complete();
    this.subscription?.unsubscribe();
  }

  /**
   * Cancel the command
   * This will cancel HTTP requests if used
   */
  cancel() {
    this.subscription?.unsubscribe();
    if (this._result$.closed) return;
    this.setError(new CancelledError());
  }
}

