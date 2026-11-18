#!/usr/bin/env node
/**
 * Runs Vitest with a normalised working directory.
 *
 * On Windows, shells such as Git Bash or VS Code terminals can start Node with a lower-case drive
 * letter (c:\…). Vitest then loads two copies of its runner and every suite fails with
 * "Cannot read properties of undefined (reading 'config')". Normalising the drive letter before
 * Vitest starts avoids it. On other platforms this is a transparent pass-through.
 */
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)
const upperDrive = (p) => p.replace(/^[a-z]:/, (drive) => drive.toUpperCase())
const cwd = upperDrive(process.cwd())
// The CLI path must use the same drive-letter case as the working directory.
const bin = upperDrive(path.join(path.dirname(require.resolve('vitest/package.json')), 'vitest.mjs'))

const result = spawnSync(process.execPath, [bin, ...process.argv.slice(2)], { cwd, stdio: 'inherit' })
process.exit(result.status ?? 1)
