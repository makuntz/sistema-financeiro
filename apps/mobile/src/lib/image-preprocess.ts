import * as ImageManipulator from 'expo-image-manipulator';

const MAX_SIDE = 2400;

export type PreprocessedImage = {
  uri: string;
  width: number;
  height: number;
  mimeType: 'image/jpeg';
  sizeInBytes: number;
};

export async function preprocessReceiptImage(uri: string): Promise<PreprocessedImage> {
  const original = await ImageManipulator.manipulateAsync(uri, [], {
    format: ImageManipulator.SaveFormat.JPEG,
  });

  const resizeAction =
    original.width >= original.height
      ? original.width > MAX_SIDE
        ? [{ resize: { width: MAX_SIDE } }]
        : []
      : original.height > MAX_SIDE
        ? [{ resize: { height: MAX_SIDE } }]
        : [];

  const manipulated = await ImageManipulator.manipulateAsync(
    uri,
    [...resizeAction, { rotate: 0 }],
    {
      compress: 0.85,
      format: ImageManipulator.SaveFormat.JPEG,
    },
  );

  const response = await fetch(manipulated.uri);
  const blob = await response.blob();

  return {
    uri: manipulated.uri,
    width: manipulated.width,
    height: manipulated.height,
    mimeType: 'image/jpeg',
    sizeInBytes: blob.size,
  };
}
