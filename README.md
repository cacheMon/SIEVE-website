# SIEVE-website
mkdoc source code for SIEVE webpage

## Local build
1. Set up a virtual environment
```bash
python3 -m venv .venv
source .venv/bin/activate
```

2. Open up a terminal and install Material for MkDocs with (starting from 9.2.0b0, Material supports blog feature):
```bash
pip3 install mkdocs-material=="9.2.0b0"
```

3. Install minify plugin
```bash
pip3 install mkdocs-minify-plugin
```

4. Previewing the website
```bash
mkdocs serve
```