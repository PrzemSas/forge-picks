#!/usr/bin/env node
// Assemble title + clip A + clip B → forge-picks-demo.mp4
import { readdirSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const DIR = dirname(fileURLToPath(import.meta.url))
const FFMPEG = process.env.FFMPEG || '/home/gorweld/bin/ffmpeg'
const OUT = process.env.OUT || '/home/gorweld/forge-picks-demo.mp4'
const VIDEO_DIR = join(DIR, 'video')

const files = readdirSync(VIDEO_DIR)
  .filter((f) => f.endsWith('.webm'))
  .map((f) => ({ f, t: statSync(join(VIDEO_DIR, f)).mtimeMs }))
  .sort((a, b) => a.t - b.t)

if (files.length < 2) {
  console.error('Need 2 webm clips in', VIDEO_DIR, 'found:', files.length)
  process.exit(1)
}

const clipA = join(VIDEO_DIR, files[files.length - 2].f)
const clipB = join(VIDEO_DIR, files[files.length - 1].f)
const title = join(DIR, 'title.png')

console.log('clipA:', clipA)
console.log('clipB:', clipB)

// title 3s, fade between segments
const filter = [
  '[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p,trim=duration=3,tpad=stop_mode=clone:stop_duration=0.3[title]',
  '[1:v]scale=1920:1080,fps=30,format=yuv420p,setpts=PTS-STARTPTS,fade=t=in:st=0:d=0.5[va]',
  '[2:v]scale=1920:1080,fps=30,format=yuv420p,setpts=PTS-STARTPTS,fade=t=in:st=0:d=0.5[vb]',
  '[title][va]concat=n=2:v=1:a=0[v01]',
  '[v01][vb]concat=n=2:v=1:a=0[vout]',
].join(';')

const r = spawnSync(
  FFMPEG,
  [
    '-y',
    '-loop', '1', '-i', title,
    '-i', clipA,
    '-i', clipB,
    '-filter_complex', filter,
    '-map', '[vout]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    OUT,
  ],
  { stdio: 'inherit' },
)

if (r.status !== 0) process.exit(r.status ?? 1)
console.log('DONE:', OUT)