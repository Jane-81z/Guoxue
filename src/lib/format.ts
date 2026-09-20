/** 体积读数：KB 取整、MB 保留一位，用于设置页与同步提示 */
export function formatBytes(bytes: number): string {
  if (!bytes) return '0 MB'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
