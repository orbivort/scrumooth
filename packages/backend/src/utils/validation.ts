const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

/**
 * Whether a value carries at least one measured value.
 *
 * Used to decide if a Product Goal snapshot is evidence of progress: only a non-empty
 * metric-name-to-value map qualifies. `null`, `{}`, a scalar or an array records no
 * inspected outcome, so it cannot close a Product Goal.
 */
export function hasMeasuredValues(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  return Object.keys(value).length > 0;
}

/**
 * Safely extract a string value from Express req.params
 * In Express 5, req.params values can be string | string[]
 * This function ensures we always get a single string value
 */
export function getParamValue(param: string | string[] | undefined): string | undefined {
  if (Array.isArray(param)) {
    return param[0];
  }
  return param;
}
