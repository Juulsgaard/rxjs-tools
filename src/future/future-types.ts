
export class FutureLoading<T> {
  constructor(public value?: T) {
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

export class FutureEmpty {
  constructor() { }
}

export type FutureUnion<T> = FutureLoading<T> | FutureError<T> | FutureValue<T> | FutureEmpty;
