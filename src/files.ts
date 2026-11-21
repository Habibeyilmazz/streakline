import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { MAX_BACKUP_CHARS } from './logic/backup';

/** Hand a JSON file to the user: a download in the browser, the share sheet on a phone. */
export async function saveTextFile(name: string, text: string): Promise<void> {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write(text);
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'Save your Streakline backup' });
}

/** Let the user choose a file and return its text, or null if they cancelled. */
export async function pickTextFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain'], copyToCacheDirectory: true });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if ((asset.size ?? 0) > MAX_BACKUP_CHARS) throw new Error('That file is too large to be a Streakline backup.');
  return asset.file ? asset.file.text() : new File(asset.uri).text();
}
