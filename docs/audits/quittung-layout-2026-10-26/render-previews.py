#!/usr/bin/env python3
"""Export representative pages from the PDFs verified by verify-layout.py."""
from pathlib import Path
import json
import subprocess

root = Path(__file__).resolve().parent
results = json.loads((root / 'layout-verification.json').read_text())
for name, fixture in results['fixtures'].items():
    # Remove only this harness's stale continuation images after a page-count change.
    for previous in root.glob(f'{name}-page*.png'):
        previous.unlink()
    for page in sorted({1, min(2, fixture['pages']), fixture['pages']}):
        stem = name if page == 1 else f'{name}-page{page}'
        subprocess.run(['pdftoppm', '-f', str(page), '-singlefile', '-png', '-scale-to', '1400', str(root / f'{name}.pdf'), str(root / stem)], check=True)
        print(f'{stem}.png')
