#!/usr/bin/env node
// Retained entry refuses before loading configuration, managers or providers.
process.stderr.write('Guide launcher retired. See ops/bots/persistent-service/README.md for the unbound service source template.\n');
process.exitCode = 2;
