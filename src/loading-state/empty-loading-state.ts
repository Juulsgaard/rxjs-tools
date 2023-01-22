import {ILoadingState} from "./loading-state.interface";
import {EMPTY, of} from "rxjs";

/**
 * An empty loading state
 */
export class EmptyLoadingState extends ILoadingState {

  readonly loading$ = of(false);
  readonly error$ = EMPTY;
  readonly failed$ = of(false);
  readonly loading = false;
  readonly isAsync = false;

  cancel() {
  }
}

