# Updating the fork

```
nix flake update
```

```
git fetch upstream -p
git merge upstream/main
```

- Fix merge conflicts
- Update package.json version
- Update .github/workflows/lel-ci.yml to match .github/workflows/ci.yml

```
pnpm install
pnpm run format
pnpm run generate
pnpm run lint
```

```
./nix/update.sh
```

## Testing

```
nix run .
```
