import {writeCoastalFlight} from './coastal-flight';
import {writeExteriorGates} from './exterior-gates';
import { writeHubMasters } from './hub-art';
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';
/** Native 1 SVG unit = 1 pixel; no resize or image synthesis involved. */
export async function exportCustomArt(): Promise<void> {
  await writeCoastalFlight();
  writeHubMasters();
  writeExteriorGates();
  await mkdir('assets/tilesets/original', { recursive: true });
  for (const name of ['zodiac', 'magic', 'campus', 'amenities', 'guides', 'wayfinding', 'hub-buildings', 'hub-labels', 'coastal', 'exterior-gates', 'naval-details']) {
    await sharp(`art/source/${name}.svg`, { density: 72 }).png().toFile(`assets/tilesets/original/${name}.png`);
  }
}
