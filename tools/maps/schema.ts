import { z } from 'zod';
import type { TiledLayer } from './types';

const positiveInt = z.number().int().positive();
const uint = z.number().int().min(0).max(0xffffffff);
export const propertySchema = z.object({ name: z.string(), type: z.string(), value: z.union([z.string(), z.number(), z.boolean(), z.null(), z.record(z.unknown())]) }).passthrough();
const layerBase = z.object({
  id: positiveInt, name: z.string(), visible: z.boolean().optional(), opacity: z.number().optional(),
  x: z.number().int().optional(), y: z.number().int().optional(), offsetx: z.number().optional(), offsety: z.number().optional(),
  properties: z.array(propertySchema).optional(),
});
const objectSchema = z.object({
  id: positiveInt, name: z.string(), x: z.number(), y: z.number(), width: z.number().nonnegative(), height: z.number().nonnegative(),
  gid: uint.optional(), properties: z.array(propertySchema).optional(),
}).passthrough();
const layerSchema: z.ZodType<TiledLayer> = z.lazy(() => z.discriminatedUnion('type', [
  layerBase.extend({ type: z.literal('tilelayer'), width: positiveInt, height: positiveInt, data: z.array(uint) }).passthrough(),
  layerBase.extend({ type: z.literal('objectgroup'), objects: z.array(objectSchema) }).passthrough(),
  layerBase.extend({ type: z.literal('group'), layers: z.array(layerSchema) }).passthrough(),
  layerBase.extend({ type: z.literal('imagelayer'), image: z.string() }).passthrough(),
]));
export const tiledMapSchema = z.object({
  type: z.literal('map'), version: z.union([z.string(), z.number()]), tiledversion: z.string().optional(),
  orientation: z.string(), infinite: z.boolean(), width: positiveInt, height: positiveInt, tilewidth: positiveInt, tileheight: positiveInt,
  properties: z.array(propertySchema).optional(), layers: z.array(layerSchema),
  tilesets: z.array(z.object({
    firstgid: positiveInt, name: z.string().optional(), source: z.string().optional(),
    tilewidth: positiveInt.optional(), tileheight: positiveInt.optional(), tilecount: positiveInt.optional(), columns: z.number().int().nonnegative().optional(),
    image: z.string().optional(), imagewidth: positiveInt.optional(), imageheight: positiveInt.optional(),
    tiles: z.array(z.object({ id: z.number().int().nonnegative(), properties: z.array(propertySchema).optional() }).passthrough()).optional(),
  }).passthrough()),
}).passthrough();
