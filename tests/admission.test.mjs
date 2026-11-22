import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import semver from 'semver';

// Admission, not a list of verified runtimes. The published plugin manager
// uses includePrerelease, so <0.3.0 alone would admit 0.3.0-alpha.1.
const { engines } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const examples = [
  [false, '0.0.1-rc.1', '0.0.1-rc.2', '0.0.1-rc.4'],
  [true, '0.0.1-rc.5', '0.0.1', '0.1.2-alpha.2', '0.2.1-rc.2', '0.2.2-rc.5', '0.2.3-alpha.2'],
  [true, '0.2.4-rc.1', '0.2.99'], // hypothetical; no recertification implied
  [false, '0.3.0-0', '0.3.0-alpha.1', '0.3.0', '1.0.0-rc.1', '1.0.0'],
];
for (const [eligible, ...versions] of examples) {
  for (const version of versions) test('manifest ' + (eligible ? 'admits ' : 'rejects ') + version, () => {
    assert.equal(semver.satisfies(version, engines.dsh, { includePrerelease: true }), eligible);
  });
}
