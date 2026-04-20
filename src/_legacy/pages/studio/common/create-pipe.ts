export const createPipe =
  <T>(initialValue: T) =>
  (...fns: Array<(arg: T) => T>) =>
    fns.reduce((acc, fn) => fn(acc), initialValue);
