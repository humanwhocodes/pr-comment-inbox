/// <reference types="astro/client" />

declare namespace Cloudflare {
  interface Env {
    GITHUB_CLIENT_ID?: string;
    GITHUB_CLIENT_SECRET?: string;
  }
}

declare namespace App {
  interface Locals {
    token: string | null;
  }
}
