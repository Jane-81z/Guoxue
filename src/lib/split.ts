/**
 * 按单换行切分文本：每个非空行即一段。
 * 兼容 CRLF / CR，逐行去首尾空白，丢弃空行。
 */
export function splitPassages(raw: string): string[] {
  if (!raw) return []
  return raw
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

/** 段落数组 -> 可编辑文本（每行一段） */
export function joinPassages(lines: string[]): string {
  return lines.join('\n')
}
