/**
 * Writing the wiki capture credentials — and nothing else.
 *
 * This module exists for one reason: the mode has to be re-applied, and that has to be
 * testable without running the seed.
 *
 * `writeFileSync(path, data, { mode: 0o600 })` sets the mode only when the file is
 * CREATED. On an existing file the mode argument is ignored, so a `credentials.json`
 * left behind by an earlier run at 0644 stayed 0644 while the log cheerfully announced
 * "mode 600". The file holds a login password and an API URL; the announcement was the
 * only thing that was 600 about it.
 *
 * So: write, then `chmod` explicitly. The chmod is not a belt-and-braces extra — on the
 * overwrite path it is the only thing that sets the mode at all.
 */
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

/** Mode of the credentials file: owner read/write, nobody else. */
export const CREDENTIALS_MODE = 0o600;

/**
 * Write `<dir>/credentials.json` and return its path.
 *
 * The directory is created if needed. The mode is enforced on every write, whether the
 * file existed before or not.
 */
export const writeRuntimeCredentials = (dir, credentials) => {
  mkdirSync(dir, { recursive: true });
  const ziel = path.join(dir, "credentials.json");
  writeFileSync(ziel, `${JSON.stringify(credentials, null, 2)}\n`, { mode: CREDENTIALS_MODE });
  // Wirkt auch dann, wenn die Datei schon existierte — der `mode` oben tut das nicht.
  chmodSync(ziel, CREDENTIALS_MODE);
  return ziel;
};
