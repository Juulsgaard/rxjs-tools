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

  /**
   * Promise implementation, immediate executes
   * @param next - Is executed immediately
   * @param error - Is never executed
   */
  then(next: () => void, error?: (error: Error) => void): this {
    next();
    return this;
  }

  /**
   * Promise implementation, never executes
   * @param func - Is never executed
   */
  catch(func: (error: Error) => void): this {
    return this;
  }

  /**
   * Promise implementation, immediate executes
   * @param func - Is executed immediately
   */
  finally(func: () => void): this {
    func();
    return this;
  }
}

