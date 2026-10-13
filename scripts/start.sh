#!/bin/bash
set -e
cd /Users/jase/arena
export PATH="/opt/homebrew/bin:/usr/bin:/bin:$PATH"
export PORT=3131
exec /opt/homebrew/bin/npm run dev
