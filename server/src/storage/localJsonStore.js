import fs from 'fs';
import path from 'path';
import { randomBytes, randomUUID } from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultDataDir = path.resolve(__dirname, '../../data');

const getFilePath = (collection) => path.join(
  process.env.LOCAL_DATA_DIR || defaultDataDir,
  `${collection}.json`
);

export const newLocalId = () => randomBytes(12).toString('hex');

export const readLocalCollection = (collection) => {
  const filePath = getFilePath(collection);
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!Array.isArray(parsed)) throw new Error('Invalid collection format.');
    return parsed;
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw new Error(`Local ${collection} data could not be read.`);
  }
};

export const writeLocalCollection = (collection, records) => {
  if (!Array.isArray(records)) throw new Error('Local collection data must be an array.');
  const filePath = getFilePath(collection);
  const directory = path.dirname(filePath);
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;

  try {
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(temporaryPath, JSON.stringify(records, null, 2), {
      encoding: 'utf8',
      mode: 0o600,
    });
    try {
      fs.renameSync(temporaryPath, filePath);
    } catch (renameError) {
      if (process.platform === 'win32') {
        fs.copyFileSync(temporaryPath, filePath);
        fs.unlinkSync(temporaryPath);
      } else {
        throw renameError;
      }
    }
  } catch {
    try {
      if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
    } catch {
      throw new Error(`Local ${collection} data could not be safely written or cleaned up.`);
    }
    throw new Error(`Local ${collection} data could not be safely written.`);
  }
};
