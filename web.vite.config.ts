import 'dotenv/config';
import { defineConfig } from "vite";
import { getMaps, getMapsOptimizers, getMapsScripts } from "wa-map-optimizer-vite";
import {VitePluginNode} from "vite-plugin-node";

import { getOptimizerOptions } from "./tools/optimizer-options";

const maps = getMaps("maps");

const optimizerOptions = getOptimizerOptions(process.env);

export default defineConfig({
    base: "./",
    build: {
        sourcemap: true,
        rollupOptions: {
            preserveEntrySignatures: "strict",
            input: {

                ...(maps.size ? getMapsScripts(maps) : { foundation: "./src/main.ts" }),
            },
        },
    },
    plugins: [
        ...getMapsOptimizers(maps, optimizerOptions),
        ...VitePluginNode({
            // Nodejs native Request adapter
            // currently this plugin support 'express', 'nest', 'koa' and 'fastify' out of box,
            // you can also pass a function if you are using other frameworks, see Custom Adapter section
            adapter: 'express',

            // tell the plugin where is your project entry
            appPath: './app/app.ts',

            // Optional, default: 'viteNodeApp'
            // the name of named export of you app from the appPath file
            exportName: 'viteNodeApp',

            // Optional, default: false
            // if you want to init your app on boot, set this to true
            initAppOnBoot: false,

            // Optional, default: false
            // if you want to reload your app on file changes, set this to true, rebounce delay is 500ms
            reloadAppOnFileChange: false,
        })
    ],
    server: {
        host: "localhost",
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
            "Access-Control-Allow-Headers": "X-Requested-With, content-type, Authorization",
            "Cache-Control": "no-cache, no-store, must-revalidate",
        },
        open: "/",
        // Ensure Vite transforms TypeScript files when served directly
        middlewareMode: false,
    },
    // Ensure TypeScript files are transformed
    esbuild: {
        include: /\.tsx?$/,
    },
});
