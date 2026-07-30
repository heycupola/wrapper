"use strict";

const core = require("js-yaml-core");

// Explicit assignments let Node's CommonJS lexer expose named ESM imports used
// by newer Mint modules while default imports still receive the full object.
exports.Type = core.Type;
exports.Schema = core.Schema;
exports.FAILSAFE_SCHEMA = core.FAILSAFE_SCHEMA;
exports.JSON_SCHEMA = core.JSON_SCHEMA;
exports.CORE_SCHEMA = core.CORE_SCHEMA;
exports.DEFAULT_SCHEMA = core.DEFAULT_SCHEMA;
exports.load = core.load;
exports.loadAll = core.loadAll;
exports.dump = core.dump;
exports.YAMLException = core.YAMLException;
exports.types = core.types;

// front-matter@4 calls the removed v3 names. js-yaml v4's load/dump are safe
// by default, so these aliases preserve behavior without restoring unsafe APIs.
exports.safeLoad = core.load;
exports.safeLoadAll = core.loadAll;
exports.safeDump = core.dump;
