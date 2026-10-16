import { LogLevel, type OptimizeOptions } from 'wa-map-optimizer-vite';

/** Shared by build and preview; return fresh settings for each configuration load. */
export function getOptimizerOptions(env: NodeJS.ProcessEnv): OptimizeOptions {
  const options: OptimizeOptions = {
    logs: env.LOG_LEVEL && Object.hasOwn(LogLevel, env.LOG_LEVEL)
      ? Number(LogLevel[env.LOG_LEVEL as keyof typeof LogLevel])
      : LogLevel.NORMAL,
  };
  if (env.TILESET_OPTIMIZATION === 'true') {
    options.output = {
      tileset: {
        compress: {
          quality: [
            env.TILESET_OPTIMIZATION_QUALITY_MIN ? parseInt(env.TILESET_OPTIMIZATION_QUALITY_MIN) : 0.9,
            env.TILESET_OPTIMIZATION_QUALITY_MAX ? parseInt(env.TILESET_OPTIMIZATION_QUALITY_MAX) : 1,
          ],
        },
      },
    };
  }
  return options;
}
