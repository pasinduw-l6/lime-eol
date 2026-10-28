import * as http from 'node:http';
import * as https from 'node:https';
import { Agent, setGlobalDispatcher } from 'undici';

/**
 * Makes every outbound request connect over IPv4.
 *
 * In the Alpine image, a normal lookup of login.microsoftonline.com returns only IPv6 addresses
 * (the answer is too large and the resolver keeps just part of it), and Docker gives the container
 * no IPv6 route, so Microsoft sign-in failed with ENETUNREACH. Asking for IPv4 addresses directly
 * works everywhere this runs. Import this before anything that makes a request.
 *
 * Both request paths are covered: fetch (undici), and the http/https modules used by libraries
 * such as jwks-rsa, which downloads Microsoft's signing keys.
 */
setGlobalDispatcher(new Agent({ connect: { family: 4 } }));
// The shared agents merge their options into every request they make.
(http.globalAgent as unknown as { options: { family?: number } }).options.family = 4;
(https.globalAgent as unknown as { options: { family?: number } }).options.family = 4;
