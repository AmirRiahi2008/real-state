{ pkgs }: {
  # Node 24 is selected by the .replit language module. These are workspace tools;
  # PostgreSQL and Redis daemons are never started implicitly by the application.
  deps = [
    pkgs.openssl
    pkgs.redis
    pkgs.postgresql
  ];
}
