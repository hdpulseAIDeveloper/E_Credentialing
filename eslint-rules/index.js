/**
 * Local ESLint plugin for the credentialing platform.
 * Wired into `.eslintrc.json` under `plugins: ["no-raw-color"]`.
 *
 * Currently exports a single rule (`no-raw-color`) — see ADR 0015.
 */
"use strict";

module.exports = {
  rules: {
    "no-raw-color": require("./no-raw-color.js"),
  },
};
