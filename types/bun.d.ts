declare module 'bun:test' {
  export interface TestContext {
    name: string;
  }

  export interface Expect {
    toBe(expected: any): void;
    toEqual(expected: any): void;
    toBeTruthy(): void;
    toBeFalsy(): void;
    toBeNull(): void;
    toBeUndefined(): void;
    toBeDefined(): void;
    toContain(item: any): void;
    toHaveLength(length: number): void;
    toThrow(error?: any): void;
    toMatch(pattern: string | RegExp): void;
    toHaveBeenCalled(): void;
    toHaveBeenCalledWith(...args: any[]): void;
    toHaveBeenCalledTimes(times: number): void;
    toHaveProperty(property: string, value?: any): void;
    not: Expect;
    resolves: Expect;
    rejects: Expect;
  }

  export interface ExpectStatic {
    (actual: any): Expect;
    objectContaining(value: any): any;
    stringContaining(value: string): any;
  }

  export const expect: ExpectStatic;
  
  export interface DescribeFunction {
    (name: string, fn: () => void): void;
    skip(name: string, fn: () => void): void;
    only(name: string, fn: () => void): void;
  }

  export const describe: DescribeFunction;

  export interface TestFunction {
    (name: string, fn: (done?: () => void) => void | Promise<void>): void;
    skip(name: string, fn: (done?: () => void) => void | Promise<void>): void;
    only(name: string, fn: (done?: () => void) => void | Promise<void>): void;
  }

  export const test: TestFunction;
  export const it: TestFunction;

  export function beforeAll(fn: () => void | Promise<void>): void;
  export function afterAll(fn: () => void | Promise<void>): void;
  export function beforeEach(fn: () => void | Promise<void>): void;
  export function afterEach(fn: () => void | Promise<void>): void;

  export interface MockCalls<T extends any[] = any[]> {
    length: number;
    [n: number]: T;
  }

  export interface MockContext<T extends (...args: any[]) => any> {
    calls: MockCalls<Parameters<T>>;
    instances: ReturnType<T>[];
    invocationCallOrder: number[];
    results: { type: string; value: ReturnType<T> }[];
  }

  export interface Mock<T extends (...args: any[]) => any = (...args: any[]) => any> {
    (...args: Parameters<T>): ReturnType<T>;
    module(moduleName: string, implementation: any): void;
    mockClear(): void;
    mockReset(): void;
    mockRestore(): void;
    mockImplementation(fn: T): this;
    mockImplementationOnce(fn: T): this;
    mockReturnValue(value: ReturnType<T>): this;
    mockReturnValueOnce(value: ReturnType<T>): this;
    mockResolvedValue(value: ReturnType<T>): this;
    mockResolvedValueOnce(value: ReturnType<T>): this;
    mockRejectedValue(value: any): this;
    mockRejectedValueOnce(value: any): this;
    getMockName(): string;
    mock: MockContext<T>;
  }

  export interface MockFunction {
    <T extends (...args: any[]) => any>(implementation?: T): Mock<T>;
    module(moduleName: string, implementation: any): void;
  }

  export const mock: MockFunction;
}