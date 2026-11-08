import vinext from "vinext";
import {existsSync,readFileSync} from "node:fs";
import type {Plugin} from "vite";
import { defineConfig } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { readExecutionProfile } from "./scripts/execution-profile.mjs";
import { configureToolEnvironment } from "./scripts/tool-environment.mjs";
import { sites } from "./scripts/vite/sites-vite-plugin";
import { connectorPreview } from "./scripts/vite/connector-preview-plugin.mjs";

// Opt-in fictional identity for local browser QA only. configureServer never runs in production.
function adminPreview():Plugin{return {name:'aralik-local-admin-preview',configureServer(server){
 const file=process.cwd()+'/.sites-runtime/admin-preview.json';if(!existsSync(file))return;
 const sample=JSON.parse(readFileSync(file,'utf8')) as {id:string;email:string};
 if(!sample.id.startsWith('preview-')||!sample.email.endsWith('@sites.test'))throw new Error('Preview identity must be fictional.');
 server.middlewares.use((req,_res,next)=>{const host=(req.headers.host||'').split(':')[0];if(['terminal.local','localhost','127.0.0.1'].includes(host)){
  for(const [name,value] of Object.entries({'oai-authenticated-user-id':sample.id,'oai-authenticated-user-email':sample.email})){
   req.headers[name]=value;for(let i=req.rawHeaders.length-2;i>=0;i-=2)if(req.rawHeaders[i].toLowerCase()===name)req.rawHeaders.splice(i,2);req.rawHeaders.push(name,value);
  }
 }next();});
}};}

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";
const managedLinux = readExecutionProfile() === "managed-linux";

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: "site-creator-d1",
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: "site-creator-r2",
        },
      ]
    : [],
};

export default defineConfig(async ({ command }) => {
  configureToolEnvironment(process.cwd());

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  if(process.env.ARALIK_BUILD_TARGET==='standalone')return {
    plugins:[vinext(),cloudflare({
      configPath:existsSync('wrangler.standalone.json')?'wrangler.standalone.json':'deployment/wrangler.template.json',
      viteEnvironment:{name:'rsc',childEnvironments:['ssr']},inspectorPort:false,
    })],
  };

  return {
    server: {
      ...(managedLinux
        ? { host: "0.0.0.0", allowedHosts: ["terminal.local"] }
        : {}),
      ...(isCodexSeatbeltSandbox
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {}),
    },
    plugins: [
      vinext(),
      sites({ mockAuth: !managedLinux }),
      ...(command === "serve" ? [adminPreview()] : []),
      connectorPreview(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        config: {
          ...localBindingConfig,
          ...(command === "serve"
            ? {
                services: [
                  {
                    binding: "CONNECTORS",
                    service: "sites-connector-preview",
                    entrypoint: "ConnectorPreview",
                  },
                ],
              }
            : {}),
        },
        ...(command === "serve"
          ? {
              auxiliaryWorkers: [
                {
                  config: {
                    name: "sites-connector-preview",
                    main: "./scripts/connector-preview/worker.mjs",
                    compatibility_date: "2026-05-15",
                  },
                },
              ],
            }
          : {}),
      }),
    ],
  };
});
