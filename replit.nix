{pkgs}: {
  deps = [
    pkgs.gh
    pkgs.nodejs
    pkgs.nodePackages.typescript-language-server
    pkgs.postgresql
  ];
}
