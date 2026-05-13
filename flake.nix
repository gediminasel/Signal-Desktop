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
          buildInputs = [ ];
          preBuild = "";
          buildPhase = ''
            pnpm run generate
            pnpm run lint-prettier
            pnpm run oxlint
            pnpm run lint-css
          '';
          installPhase = "touch $out";
        });
      }
    );
}
