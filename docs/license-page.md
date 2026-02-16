# License Page Maintenance

## Data Sources

- Software metadata: `package.json`
- Open data metadata: `src/lib/license/openDataLicenses.json`
- Dependency licenses: `public/licenses/dependencies.json`

## UI Policy

- Prioritize DaisyUI components (`card`, `list`, `badge`, `divider`)
- Avoid introducing custom UI parts unless unavoidable

## Update Flow

1. Update package metadata in `package.json` when project info changes.
2. Edit `src/lib/license/openDataLicenses.json` for open-data changes.
3. Regenerate dependency license output during build.
4. Verify `/license` rendering and `/api/licenses` response.

## Validation

Run:

```bash
npx tsc --noEmit
npm run lint
npm test
npm run build
```
