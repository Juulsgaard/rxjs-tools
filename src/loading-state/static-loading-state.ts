import {IValueLoadingState} from "./value-loading-state.interface";
import {EMPTY, Observable, of} from "rxjs";

/**
 * A loading state representing a static value
 */
export class StaticLoadingState<T> extends IValueLoadingState<T> {

  readonly loading$ = of(false);
  readonly error$ = EMPTY;
  readonly failed$ = of(false);
  readonly loading = false;
  readonly isAsync = false;

  readonly result$: Observable<T>;

  get resultAsync() {
    return Promise.resolve(this.value)
  }

  constructor(private value: T) {
    super();
    this.result$ = of(value);
  }

  cancel() {
  }
}

