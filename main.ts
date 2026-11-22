/**
 * Entry point for this bring-the-humans-03 entry.
 *
 * The gate reads /output/VIDEO.json, which has to be a byte-for-byte copy of the
 * VIDEO.json at this repository's root. That is this program's whole job: hand the
 * posted video's address across, and fail loudly and usefully when it cannot.
 *
 * Node 22 standard library only. No network, no clock, no path outside the
 * repository and its output directory, and no state carried between runs, so two
 * runs on the same commit write the same bytes.
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const BOT_DIR = process.env.MAKEFUN_BOT_DIR ?? '/bot';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const FILE_NAME = 'VIDEO.json';

/** Stop with a message that says what is wrong and what to do about it. */
function fail(reason: string, hint?: string): never {
  console.error(`makefun entry: cannot hand in ${FILE_NAME}`);
  console.error(`  problem: ${reason}`);
  if (hint !== undefined) console.error(`  fix:     ${hint}`);
  process.exit(1);
  // exit() does not return; this throw only tells a type checker that the
  // function really cannot fall through to its caller.
  throw new Error('unreachable');
}

const repoDir = resolve(BOT_DIR);
const outDir = resolve(OUTPUT_DIR);
const source = join(repoDir, FILE_NAME);
const destination = join(outDir, FILE_NAME);

/* 1. The file has to be there before anything else can happen. */
if (!existsSync(source)) {
  fail(
    `there is no ${FILE_NAME} in ${repoDir}`,
    `put ${FILE_NAME} at the root of the repository, holding the video's address`,
  );
}

let sourceBytes: Buffer;
try {
  if (!statSync(source).isFile()) {
    fail(`${source} is not a regular file`, `replace it with the ${FILE_NAME} the gate reads`);
  }
  sourceBytes = readFileSync(source);
} catch (error) {
  fail(`could not read ${source}: ${(error as Error).message}`, 'check the file permissions');
}

/* 2. It has to parse as a JSON object with a string url, or the gate has nothing
 *    to read. The address itself is a person's job to paste in correctly. */
try {
  const parsed: unknown = JSON.parse(sourceBytes.toString('utf8'));
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    fail(
      `${FILE_NAME} holds ${Array.isArray(parsed) ? 'an array' : typeof parsed}, not a JSON object`,
      `it should read {"url": "https://www.tiktok.com/@<handle>/video/<id>"}`,
    );
  }
  const url = (parsed as Record<string, unknown>).url;
  if (typeof url !== 'string' || url.trim() === '') {
    fail(`${FILE_NAME} has no "url" string`, 'add the posted video\'s full address as "url"');
  }
} catch (error) {
  fail(`${FILE_NAME} is not valid JSON: ${(error as Error).message}`, 're-save it as plain JSON');
}

/* 3. Write the copy. */
try {
  mkdirSync(outDir, { recursive: true });
} catch (error) {
  fail(`could not create ${outDir}: ${(error as Error).message}`, 'check the directory permissions');
}

try {
  copyFileSync(source, destination);
} catch (error) {
  fail(`could not write ${destination}: ${(error as Error).message}`, 'check the directory permissions');
}

/* 4. Read it back: a copy that did not land intact is a failure, not a success. */
let writtenBytes: Buffer;
try {
  writtenBytes = readFileSync(destination);
} catch (error) {
  fail(`${destination} is missing right after writing it: ${(error as Error).message}`);
}
if (writtenBytes.length !== sourceBytes.length || !writtenBytes.equals(sourceBytes)) {
  fail(
    `${destination} does not match ${source} (${writtenBytes.length} vs ${sourceBytes.length} bytes)`,
    'delete the output directory and run again',
  );
}
