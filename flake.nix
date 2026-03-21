{
  inputs = {
    nixpkgs.url = "nixpkgs/nixpkgs-25.11-darwin";
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
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        devShell = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs_20
            gh
            php83
            php83Packages.composer
            minio
          ];
        };
      }
    );
}
