#!/bin/bash
cd "$(dirname "$0")/.."
source .venv/bin/activate
export PYTHONPATH="$(pwd)"
python3 -m pipeline.news_crawler
