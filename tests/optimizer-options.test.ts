import { expect, it } from 'vitest';
import { getOptimizerOptions } from '../tools/optimizer-options';

it('defaults to normal logging without compression', () => {
  expect(getOptimizerOptions({})).toEqual({ logs: 1 });
});
it.each([{ LOG_LEVEL: 'NONE', want: 0 }, { LOG_LEVEL: 'VERBOSE', want: 2 }, { LOG_LEVEL: 'unknown', want: 1 }])('chooses the configured named logging level $LOG_LEVEL', ({ LOG_LEVEL, want }) => {
  expect(getOptimizerOptions({ LOG_LEVEL })).toEqual({ logs: want });
});
it('preserves existing compression parsing and forwards its values', () => {
  expect(getOptimizerOptions({ TILESET_OPTIMIZATION: 'true', TILESET_OPTIMIZATION_QUALITY_MIN: '0.91', TILESET_OPTIMIZATION_QUALITY_MAX: '0.98' })).toEqual({ logs: 1, output: { tileset: { compress: { quality: [0, 0] } } } });
});
it('uses default compression qualities when enabled without overrides', () => {
  expect(getOptimizerOptions({ TILESET_OPTIMIZATION: 'true' })).toEqual({ logs: 1, output: { tileset: { compress: { quality: [0.9, 1] } } } });
});
it('does not leak compression settings into a later disabled configuration', () => {
  getOptimizerOptions({ TILESET_OPTIMIZATION: 'true' });
  expect(getOptimizerOptions({ TILESET_OPTIMIZATION: 'false', TILESET_OPTIMIZATION_QUALITY_MIN: '0.91' })).toEqual({ logs: 1 });
});

it('retains optimizer options in the authoring Vite configuration', async () => {
  const { loadConfigFromFile } = await import('vite');
  const { resolve } = await import('node:path');
  for (const file of ['web.vite.config.ts']) {
    const loaded = await loadConfigFromFile({ command: 'build', mode: 'production' }, file);
    expect(loaded?.dependencies.map(path => resolve(path))).toContain(resolve('tools/optimizer-options.ts'));
    expect(loaded?.config.base).toBe('./');
  }
});
