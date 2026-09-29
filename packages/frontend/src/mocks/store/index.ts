/**
 * The mock backend's working copy and the session acting on it.
 *
 * This layer consumes the frozen fixtures and knows nothing about HTTP: no
 * request, response, status code or envelope appears anywhere below it. Handlers
 * translate HTTP into calls here, which is what keeps the two concerns apart —
 * a rule change belongs in the store, a contract change belongs in a handler.
 */

export * from './db';
export * from './session';
export * from './timeboxes';
export * from './reset';
