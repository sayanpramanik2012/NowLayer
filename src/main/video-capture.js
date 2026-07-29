const MAX_SOURCE_ID_LENGTH = 512;
const MAX_SOURCE_NAME_LENGTH = 200;

function safeText(value, maxLength) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').slice(0, maxLength);
}

function normalizeVideoState(value = {}) {
  return {
    active: value.active === true,
    sourceId: safeText(value.sourceId, MAX_SOURCE_ID_LENGTH),
    sourceName: safeText(value.sourceName, MAX_SOURCE_NAME_LENGTH),
    revision: Number.isSafeInteger(value.revision) && value.revision >= 0
      ? value.revision
      : 0,
    error: safeText(value.error, 500),
  };
}

function toRendererSource(source) {
  if (!source || typeof source.id !== 'string' || typeof source.name !== 'string') return null;
  const name = safeText(source.name, MAX_SOURCE_NAME_LENGTH);
  if (!name || /nowlayer/i.test(name)) return null;
  return {
    id: safeText(source.id, MAX_SOURCE_ID_LENGTH),
    name,
    thumbnail: source.thumbnail?.isEmpty?.() === false
      ? source.thumbnail.toDataURL()
      : '',
    appIcon: source.appIcon?.isEmpty?.() === false
      ? source.appIcon.toDataURL()
      : '',
  };
}

function findSelectedSource(sources, selectedId) {
  const safeId = safeText(selectedId, MAX_SOURCE_ID_LENGTH);
  if (!safeId) return null;
  return sources.find((source) => source?.id === safeId) ?? null;
}

module.exports = {
  findSelectedSource,
  normalizeVideoState,
  toRendererSource,
};
