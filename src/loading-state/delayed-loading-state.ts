import {from, isObservable, Observable, of, Subject, switchMap, tap} from "rxjs";
import {first, map} from "rxjs/operators";
import {permanentCache} from "../operators/cache";
import {LoadingState} from "./loading-state";

export class DelayedLoadingState<TData> extends LoadingState<TData> {

  triggerSubject: Subject<void>;
  trigger$: Observable<TData>;

  constructor(action: () => TData | Promise<TData> | Observable<TData>, modify?: (data: TData) => TData | void) {
    const triggerSubject = new Subject<void>();

    super(triggerSubject.pipe(
      first(),
      switchMap(() => {
        const data = action();
        if (isObservable(data)) return data;
        if (data instanceof Promise) return from(data);
        return of(data);
      }),
      map(data => modify?.(data) ?? data)
    ));

    this.triggerSubject = triggerSubject;
    this.trigger$ = this.result$.pipe(tap({subscribe: () => this.trigger()}), permanentCache());
  }

  trigger() {
    if (this.triggerSubject.closed) return;
    this.triggerSubject.next();
    this.triggerSubject.complete();
  }
}
