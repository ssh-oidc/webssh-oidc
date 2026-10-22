#!/bin/bash
set -e

/usr/sbin/motley-cue &
motley_cue_pid=$!
/usr/sbin/sshd -D -e &
sshd_pid=$!

set +e
wait -n "$motley_cue_pid" "$sshd_pid"
status=$?
kill "$motley_cue_pid" "$sshd_pid" 2>/dev/null
wait
exit "$status"