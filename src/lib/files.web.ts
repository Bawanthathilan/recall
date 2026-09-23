/** Web version of files.ts: the browser's file picker and a normal download. */
import * as DocumentPicker from 'expo-document-picker';

export type PickedFile = { name: string; size: number | null; bytes: () => Promise<Uint8Array>; text: () => Promise<string> };

export async function pickFile(types: string[] = ['*/*']): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: types, base64: false });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const blob: Blob = asset.file ?? (await (await fetch(asset.uri)).blob());
  return {
    name: asset.name,
    size: asset.size ?? null,
    bytes: async () => new Uint8Array(await blob.arrayBuffer()),
    text: () => blob.text(),
  };
}

export async function saveFile(name: string, contents: string, mimeType: string, _uti: string) {
  const url = URL.createObjectURL(new Blob([contents], { type: mimeType }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
