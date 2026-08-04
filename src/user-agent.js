import { createRequire } from 'node:module';

// Read the shipped version at runtime so the tracking string always matches the
// installed package (no hardcoded version to drift).
const require = createRequire(import.meta.url);
const { version } = require('../package.json');

export const WIZARD_VERSION = version;

// Sent on every request the wizard makes to the Rootly API so server-side logs
// and analytics can attribute traffic to the setup wizard (and its version) —
// a reliable first-party usage signal that npm/GitHub download counts can't
// give (those are dominated by mirrors, scanners, and CI).
export const USER_AGENT = `rootly-wizard/${version} (+https://github.com/rootlyhq/rootly-wizard)`;

// Explicit, machine-parseable marker alongside the User-Agent, so the API side
// can filter/aggregate wizard traffic without parsing UA strings.
export const CLIENT_HEADER_NAME = 'X-Rootly-Client';
export const CLIENT_HEADER_VALUE = `rootly-wizard/${version}`;

// Merge into any fetch() to the Rootly API to tag it as wizard-originated.
export const trackingHeaders = {
  'User-Agent': USER_AGENT,
  [CLIENT_HEADER_NAME]: CLIENT_HEADER_VALUE
};
