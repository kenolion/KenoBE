import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const APP_DIR = process.env.APP_DIR || path.normalize(__dirname + '/..');
export const OUT_PATH = path.normalize(APP_DIR + '/..'+ "/output/") ;
export const VID_STATS_NM = '-stats';
export const VID_MSG_NM = '-msg';
