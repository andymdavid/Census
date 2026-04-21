declare module 'bun:sqlite' {
  export class Statement {
    run(...params: unknown[]): unknown;
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown;
  }

  export class Database {
    constructor(filename: string);
    exec(sql: string): void;
    prepare(sql: string): Statement;
    transaction<T extends (...args: never[]) => unknown>(callback: T): T;
  }
}
