#!/usr/bin/env python3
"""One command to rebuild data/processed/ from data/raw/ (offline; uses cached NRT responses).

Usage: python pipeline/build.py
AI-assisted code. Licensed under Apache-2.0.
"""
import subprocess, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
for step in (['fetch_nrt.py', '--offline'], ['grid.py']):
    print('==', ' '.join(step), flush=True)
    subprocess.run([sys.executable, str(HERE / step[0]), *step[1:]], check=True, cwd=HERE)
