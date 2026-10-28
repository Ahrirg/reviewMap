import { del, getJson, sendJson } from './client.js';

/** Who the server thinks we are. A guest is an answer, never an error. */
export const fetchSession = (options) => getJson('/api/session', options);

/** The password alone identifies the account; there is no user name to send. */
export const login = (password, options) => sendJson('/api/session', { password }, options);

export const logout = (options) => del('/api/session', options);
