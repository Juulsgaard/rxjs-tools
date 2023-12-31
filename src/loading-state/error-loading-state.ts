import {ILoadingState} from "./loading-state.interface";
import {firstValueFrom, Observable, of, throwError} from "rxjs";
import {IValueLoadingState} from "./value-loading-state.interface";
import {map} from "rxjs/operators";

/**
 * A loading state representing a failure
 */
export class ErrorLoadingState extends ILoadingState {

  readonly loading$ = of(false);
  readonly error$;
  readonly failed$ = of(true);
  readonly loading = false;
  readonly isAsync = false;

  constructor(private error: Error) {
    super();
    this.error$ = of(error);
  }

  cancel() {
  }

  /**
   * Promise implementation, always errors
   * @param next - Is never called
   * @param error - Is always called with the error
   */
  then(next: () => void, error?: (error: Error) => void): this {
    error?.(this.error);
    return this;
  }

  /**
   * Promise implementation, always errors
   * @param func - Immediate gets called with error
   */
  catch(func: (error: Error) => void): this {
    func(this.error)
    return this;
  }

  /**
   * Promise implementation, is called immediately
   * @param func - Immediate gets called
   */
  finally(func: () => void): this {
    func();
    return this;
  }
}

/**
 * A loading state representing a failure
 * Spoofs being a value state
 */
export class ValueErrorLoadingState<T> extends IValueLoadingState<T> {

  readonly loading$ = of(false);
  readonly error$;
  readonly failed$ = of(true);
  readonly loading = false;
  readonly isAsync = false;

  readonly result$: Observable<T>;
  get resultAsync(): Promise<T> {
    return firstValueFrom(this.result$);
  }

  constructor(private error: () => Error) {
    super();
    this.error$ = of(undefined).pipe(map(error));
    this.result$ = throwError(error);
  }

  cancel() {
  }
}
