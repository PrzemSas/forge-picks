#!/usr/bin/env bash
# Live-broadcast style bed: quiet sports radio + stadium murmur + TTS commentary
set -euo pipefail

FFMPEG="${FFMPEG:-/home/gorweld/bin/ffmpeg}"
FFPROBE="${FFPROBE:-/home/gorweld/bin/ffprobe}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
AUDIO="$ROOT/docs/audio"
COMM="$AUDIO/commentary"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
IN="${IN:-/home/gorweld/forge-picks-demo.mp4}"
OUT="${OUT:-/home/gorweld/forge-picks-demo-with-audio.mp4}"

RADIO="$AUDIO/bbc-sports-radio-clean.wav"
CROWD="$AUDIO/stadium-crowd-ambience.mp3"
CHEER="$AUDIO/cheer-victory.mp3"

mkdir -p "$COMM"

# Generate short English commentary lines (Windows SAPI)
if ! ls "$COMM"/*.wav >/dev/null 2>&1; then
  WIN_OUT="$(wslpath -w "$COMM")"
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$(wslpath -w "$SCRIPT_DIR/gen-commentary.ps1")" -OutDir "$WIN_OUT"
fi

for f in "$RADIO" "$CROWD" "$CHEER" "$IN" kickoff goal1 goal2 goal3 fulltime; do
  case "$f" in
    kickoff|goal1|goal2|goal3|fulltime) [[ -f "$COMM/$f.wav" ]] || { echo "Missing: $COMM/$f.wav" >&2; exit 1; } ;;
    *) [[ -f "$f" ]] || { echo "Missing: $f" >&2; exit 1; } ;;
  esac
done

DUR="$("$FFPROBE" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$IN")"
KICKOFF=18.2
G1=$(awk -v k="$KICKOFF" 'BEGIN{printf "%d", (k+12)*1000}')
G2=$(awk -v k="$KICKOFF" 'BEGIN{printf "%d", (k+34)*1000}')
G3=$(awk -v k="$KICKOFF" 'BEGIN{printf "%d", (k+67)*1000}')
FT_MS=$(awk -v k="$KICKOFF" 'BEGIN{printf "%d", (k+90)*1000}')
KO_MS=$(awk -v k="$KICKOFF" 'BEGIN{printf "%d", k*1000}')
FADE_OUT=$(awk -v d="$DUR" 'BEGIN{printf "%.2f", d-3}')

# Broadcast chain: band-limited, compressed, quieter than previous mix
BC="highpass=f=180,lowpass=f=3800,acompressor=threshold=-22dB:ratio=3:attack=20:release=200"

echo "Video: $IN (${DUR}s) — live broadcast mix"

"$FFMPEG" -y \
  -stream_loop -1 -i "$RADIO" \
  -stream_loop -1 -i "$CROWD" \
  -i "$CHEER" \
  -i "$COMM/kickoff.wav" \
  -i "$COMM/goal1.wav" \
  -i "$COMM/goal2.wav" \
  -i "$COMM/goal3.wav" \
  -i "$COMM/fulltime.wav" \
  -i "$IN" \
  -filter_complex "
    [0:a]volume=0.22,${BC},afade=t=in:st=0:d=2,afade=t=out:st=${FADE_OUT}:d=2.5,atrim=0:${DUR},asetpts=PTS-STARTPTS[radio];
    [1:a]volume=0.10,highpass=f=250,lowpass=f=5000,afade=t=in:st=0:d=2,atrim=0:${DUR},asetpts=PTS-STARTPTS[crowd];
    [2:a]volume=0.22,adelay=${G1}|${G1}[ch1];
    [2:a]volume=0.22,adelay=${G2}|${G2}[ch2];
    [2:a]volume=0.24,adelay=${G3}|${G3}[ch3];
    [3:a]volume=0.95,${BC},adelay=${KO_MS}|${KO_MS}[c0];
    [4:a]volume=1.05,${BC},adelay=${G1}|${G1}[c1];
    [5:a]volume=1.05,${BC},adelay=${G2}|${G2}[c2];
    [6:a]volume=1.08,${BC},adelay=${G3}|${G3}[c3];
    [7:a]volume=1.0,${BC},adelay=${FT_MS}|${FT_MS}[c4];
    [radio][crowd][ch1][ch2][ch3][c0][c1][c2][c3][c4]amix=inputs=10:duration=first:normalize=0:dropout_transition=2,alimiter=limit=0.92:attack=5:release=80,loudnorm=I=-20:TP=-2.0:LRA=11[aout]
  " \
  -map 8:v -map '[aout]' \
  -c:v copy -c:a aac -b:a 160k -shortest \
  "$OUT"

echo "DONE: $OUT"
"$FFPROBE" -v error -show_entries stream=codec_type,codec_name,duration -of default=noprint_wrappers=1 "$OUT"
"$FFMPEG" -i "$OUT" -af volumedetect -f null - 2>&1 | grep -E 'mean_volume|max_volume'