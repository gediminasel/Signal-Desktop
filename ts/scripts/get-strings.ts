// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { execSync } from 'child_process';

const { SMARTLING_USER, SMARTLING_SECRET } = process.env;

if (!SMARTLING_USER) {
  console.error('Need to set SMARTLING_USER environment variable!');
  process.exit(1);
}
if (!SMARTLING_SECRET) {
  console.error('Need to set SMARTLING_SECRET environment variable!');
  process.exit(1);
}

console.log('Fetching latest strings!');
console.log();
execSync(
  'smartling-cli' +
    ` --user "${SMARTLING_USER}"` +
    ` --secret "${SMARTLING_SECRET}"` +
    ' --config .smartling.yml' +
    ' --verbose' +
    ' --format "_locales/{{.Locale}}/messages.json"' +
    ' files pull',
  {
    stdio: [null, process.stdout, process.stderr],
  }
);

console.log('Formatting newly-downloaded strings!');
console.log();
execSync('yarn format', {
  stdio: [null, process.stdout, process.stderr],
});
