# Wrapper Docs (Mintlify)

This docs app uses Mintlify.

## Development

```bash
bun run dev
```

## Build validation

```bash
bun run build
```

Content entrypoint: `introduction.mdx`  
Site config: `docs.json`

## Planned images

Pages contain non-rendered `{/* TODO(image): ... */}` comments at locations
where a screenshot or diagram materially improves understanding. Each comment
specifies the content, redaction requirements, suggested filename, and whether
the asset is essential or optional.

Store completed assets in `apps/docs/images/` and reference them from MDX with a
root-relative path such as `/images/wrapper-session-overview.webp`. Always add
descriptive alt text, and remove the corresponding TODO when the asset lands.
