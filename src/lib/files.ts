/**
 * Picking and saving files on iOS/Android. The web version is files.web.ts.
 *
 * Saving works through the share sheet: the file is written to the app's cache
 * folder, then iOS/Android offer "Save to Files", Google Drive, AirDrop, email…
 */
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export type PickedFile = { name: string; size: number | null; bytes: () => Promise<Uint8Array>; text: () => Promise<string> };

/** Opens the system file picker. Returns null if you cancel. */
export async function pickFile(types: string[] = ['*/*']): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: types, copyToCacheDirectory: true });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const file = new File(asset.uri);
  return { name: asset.name, size: asset.size ?? null, bytes: () => file.bytes(), text: () => file.text() };
}

/** Writes `contents` to a file and opens the share sheet so you can keep it somewhere. */
export async function saveFile(name: string, contents: string, mimeType: string, uti: string) {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(contents);
  await Sharing.shareAsync(file.uri, { mimeType, UTI: uti, dialogTitle: name });
}
