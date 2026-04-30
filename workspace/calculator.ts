// Calculation utilities
// Pure functions with explicit result type to represent success or error

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

// Adds two numbers and returns the result wrapped in a Result
export const add = (a: number, b: number): Result<number> => {
  const value = a + b;
  return { ok: true, value };
};

// Divides a by b. If divisor is zero, returns an error instead of throwing
export const divide = (a: number, b: number): Result<number> => {
  if (b === 0) {
    return { ok: false, error: 'Division by zero' };
  }
  const value = a / b;
  return { ok: true, value };
};
