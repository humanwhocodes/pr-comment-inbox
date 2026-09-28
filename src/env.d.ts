/**
 * @fileoverview Declares ambient TypeScript types used by Astro and the project runtime.
 */

/// <reference types="astro/client" />

declare namespace Cloudflare {
  interface Env {
    GITHUB_CLIENT_ID?: string;
    GITHUB_CLIENT_SECRET?: string;
    PLAUSIBLE_DOMAIN?: string;
    PLAUSIBLE_SCRIPT_SRC?: string;
  }
}

declare namespace App {
  interface Locals {
    token: string | null;
  }
}
