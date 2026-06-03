{
  description = "Signal Desktop Lel Fork";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      utils,
    }:
    utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };
        signal = pkgs.callPackage ./nix/package.nix { };
      in
      {
        packages.default = signal;

        checks.lint = signal.overrideAttrs (_old: {
          name = "signal-desktop-lint";
          postBuild = ''
            # pnpm run build:db-schema --check
            # pnpm run lint-prettier
            pnpm run lint-css
            # pnpm run check:types
            # pnpm run oxlint:ci
            pnpm run lint-deps
          '';
          installPhase = "touch $out";
        });

        devShells.default = import ./nix/shell.nix { inherit pkgs; };
      }
    );
}
