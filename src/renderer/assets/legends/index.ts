/**
 * Legend icon SVG imports.
 *
 * Each import resolves to a URL string at build time (Vite asset handling).
 * The map key is the lowercase legend name with spaces replaced by hyphens,
 * matching the SVG filenames on disk.
 */
import alter from './alter.svg';
import ash from './ash.svg';
import ballistic from './ballistic.svg';
import bangalore from './bangalore.svg';
import bloodhound from './bloodhound.svg';
import catalyst from './catalyst.svg';
import caustic from './caustic.svg';
import conduit from './conduit.svg';
import crypto from './crypto.svg';
import fuse from './fuse.svg';
import gibraltar from './gibraltar.svg';
import horizon from './horizon.svg';
import lifeline from './lifeline.svg';
import loba from './loba.svg';
import madMaggie from './mad-maggie.svg';
import mirage from './mirage.svg';
import newcastle from './newcastle.svg';
import octane from './octane.svg';
import pathfinder from './pathfinder.svg';
import rampart from './rampart.svg';
import revenant from './revenant.svg';
import seer from './seer.svg';
import sparrow from './sparrow.svg';
import valkyrie from './valkyrie.svg';
import vantage from './vantage.svg';
import wattson from './wattson.svg';
import wraith from './wraith.svg';

/** Map from legend display name to SVG URL. Case-insensitive lookup via legendIconUrl(). */
const legendIcons: Record<string, string> = {
  alter,
  ash,
  ballistic,
  bangalore,
  bloodhound,
  catalyst,
  caustic,
  conduit,
  crypto,
  fuse,
  gibraltar,
  horizon,
  lifeline,
  loba,
  'mad maggie': madMaggie,
  mirage,
  newcastle,
  octane,
  pathfinder,
  rampart,
  revenant,
  seer,
  sparrow,
  valkyrie,
  vantage,
  wattson,
  wraith,
};

/**
 * Look up the SVG URL for a legend by display name.
 * Returns undefined if no icon is available (triggers fallback in LegendIcon).
 */
export function legendIconUrl(legendName: string): string | undefined {
  return legendIcons[legendName.toLowerCase()];
}
