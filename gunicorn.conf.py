# Gunicorn picks this file up automatically from the working directory, no
# matter what start command the host (Render dashboard) uses — Render does NOT
# read the Procfile, so this file is the source of truth for server config.
#
# The Trainer streams AI-generated plans that can take a couple of minutes;
# the 30 s default timeout was killing those requests mid-stream.
workers = 2
threads = 4          # gthread worker class: long streams don't freeze the site
timeout = 300
graceful_timeout = 30
