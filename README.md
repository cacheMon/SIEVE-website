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

## How the landing page is built
- `material/home.html` is the landing page template. It extends `main.html`, which adds the fonts,
  the link-preview tags and analytics to every page.
- `material/home.css` styles the landing page. The colors are `--sv-*` tokens defined for light and
  dark in `docs/stylesheets/extra.css`, which also styles the header, the footer and the blog.
- `material/partials/header.html` is Material's header with two changes: it shows the short name
  (`extra.short_name` in `mkdocs.yml`), and on wide screens the Home and Blog tabs sit in the same row.
- `material/sim.js` runs the SIEVE simulation in "How it works", following the pseudocode in the
  blog post. Run `node -e "require('./material/sim.js')"` to load its cache model without a browser.
- `material/charts.js` draws the results charts with Chart.js and builds their data tables. The
  values were read from the vector figures in the paper and blog (`docs/assets/images/illustrations`).

## Editing the adoption list
Adopters are data at the top of `material/home.html`, one row per entry:

```jinja
("ClickHouse", "https://github.com/ClickHouse/ClickHouse/pull/123435", 54801242),
```

The fields are the name, the link, and the logo: a GitHub account id, or a path to an image under
`docs/assets`. Section headings count the rows, so adding a row is all it takes.

- Link to the code, merged PR or docs that show SIEVE in use, not just the project homepage.
- Use the account id rather than the name for GitHub logos: the name-based avatar URL returns a blank
  default for many organizations. `curl -sI https://github.com/<org>.png` shows the id in the
  redirect (`/u/<id>`).
- Open pull requests go under `in_progress` until they merge.
- Keep the list in sync with the [cacheMon homepage](https://cachemon.org/#production).
