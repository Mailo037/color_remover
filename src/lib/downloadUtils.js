export const revokeUrl = (url) => {
  if (url && url.startsWith('blob:')) URL.revokeObjectURL(url);
};

export const revokeBatchItemUrls = (item) => {
  revokeUrl(item?.pngUrl);
  revokeUrl(item?.webpUrl);
  revokeUrl(item?.jpegUrl);
  revokeUrl(item?.maskUrl);
  revokeUrl(item?.url);
};

export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};
