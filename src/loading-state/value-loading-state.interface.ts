import {Observable} from "rxjs";
import {ILoadingState} from "./loading-state.interface";

export abstract class IValueLoadingState<TData> extends ILoadingState {

  /** The result of the action */
  readonly abstract result$: Observable<TData>;

  /** A promise returning the data once resolved */
  readonly abstract resultAsync: Promise<TData>;

  /**
   * Define a callback that will be executed on a successful action
   * @param next
   * @param error
   */
  then(next: (data: TData) => void, error?: (error: Error) => void): this {
    this.result$.subscribe({next, error});
    return this;
  }

  /**
   * Define a callback that will be executed on a failed action
   * @param func
   */
  catch(func: (error: Error) => void): this {
    this.result$.subscribe({error: func});
    return this;
  }

  /**
   * Define a callback that will be executed when the action has completed (Whether it failed or succeeded)
   * @param func
   */
  finally(func: () => void): this {
    this.result$.subscribe({complete: func, error: func});
    return this;
  }
}
