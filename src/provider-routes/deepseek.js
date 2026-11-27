// In DSH 0.2.2-rc.5, both DeepSeek routes publish a settings directory entry,
// but the active adapter's public metadata has no settings namespace. A standby
// form can match the same provider/model. Do not read its values or offer a writer.
export function createDeepSeekOptions() {
  return { read: async () => [] };
}
