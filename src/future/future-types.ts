
export class FutureLoading<T> {
  constructor(public loading: boolean, public value?: T) {
  }
}

export class FutureValue<T> {
  constructor(public value: T) {
  }
}

export class FutureError<T> {
  constructor(public error: Error, public value?: T) {
  }
}

export type FutureUnion<T> = FutureLoading<T> | FutureError<T> | FutureValue<T>;
