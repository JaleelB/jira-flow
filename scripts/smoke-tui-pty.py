#!/usr/bin/env python3
"""Start a packaged JiraFlow TUI in a real Unix PTY and quit through `q`."""

import os
import pty
import select
import signal
import sys
import time


if len(sys.argv) != 2:
    raise SystemExit("usage: smoke-tui-pty.py <jira-flow-command>")

pid, terminal = pty.fork()
if pid == 0:
    os.execv(sys.argv[1], [sys.argv[1]])

output = bytearray()
deadline = time.monotonic() + 12
sent_quit = False
status = None
try:
    while time.monotonic() < deadline:
        if not sent_quit and time.monotonic() + 11 > deadline:
            os.write(terminal, b"q")
            sent_quit = True
        readable, _, _ = select.select([terminal], [], [], 0.1)
        if readable:
            try:
                output.extend(os.read(terminal, 65536))
            except OSError:
                pass
        waited, candidate = os.waitpid(pid, os.WNOHANG)
        if waited == pid:
            status = candidate
            break
finally:
    if status is None:
        os.kill(pid, signal.SIGTERM)
        _, status = os.waitpid(pid, 0)
    os.close(terminal)

if not os.WIFEXITED(status) or os.WEXITSTATUS(status) != 0:
    sys.stderr.buffer.write(output)
    raise SystemExit("packaged TUI did not exit cleanly")
if b"JiraFlow" not in output:
    sys.stderr.buffer.write(output)
    raise SystemExit("packaged TUI did not render JiraFlow")

print("packaged TUI PTY smoke passed")
