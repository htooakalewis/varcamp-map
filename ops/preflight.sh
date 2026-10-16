#!/usr/bin/env bash
set -euo pipefail
phase=full
if [[ ${1:-} == --phase ]]; then phase=${2:?phase required}; fi
if [[ $phase == full ]]; then
 echo 'MEDIA NOT READY: Task2 listeners, TURN and attendee media acceptance are not established.' >&2
 exit 1
fi
[[ $phase == core ]] || { echo 'Unknown phase' >&2; exit 1; }
cd "$(dirname "$0")/.."
python3 ops/preflight.py
