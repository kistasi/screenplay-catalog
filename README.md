# Screenplay Catalog

A simple web app for keeping a personal library of films and their screenplays.

Search for any film, add it to your catalog, and the app automatically fills in
the poster, release year, directors, and writers. You can attach the screenplay
as a PDF and read it whenever you like.

Once your catalog grows, find what you're looking for by searching titles or
filtering by year, director, or writer — and click any name or year to filter by
it instantly.

## Running with Docker

A prebuilt image is published to GitHub Container Registry. Pull and run it with:

```bash
docker pull ghcr.io/kistasi/screenplay-catalog:latest

docker run -d \
  --name screenplay-catalog \
  -p 3000:3000 \
  -v screenplay-data:/app/data \
  ghcr.io/kistasi/screenplay-catalog:latest
```

The app is then available at http://localhost:3000. The `-v` flag persists your
catalog (the JSON database and uploaded PDFs) in the `/app/data` volume so it
survives container restarts and upgrades.

Images are tagged `latest`, the branch name, and the commit SHA; pin to a SHA
tag (e.g. `ghcr.io/kistasi/screenplay-catalog:sha-2a3b0a9`) for reproducible
deployments.

## A note on the code

This project was written by [Claude Code](https://claude.com/claude-code), Anthropic's CLI coding agent.

## License

Released under the [MIT License](LICENSE).
