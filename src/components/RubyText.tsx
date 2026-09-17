import type { RubyToken } from '../types'

interface RubyTextProps {
  tokens: RubyToken[]
  showPinyin: boolean
  className?: string
}

/** 汉字上方注音（ruby）。关闭注音时只显示汉字。 */
export default function RubyText({ tokens, showPinyin, className = '' }: RubyTextProps) {
  if (!showPinyin) {
    return <span className={className}>{tokens.map((t) => t.char).join('')}</span>
  }
  return (
    <span className={`ruby-text ${className}`}>
      {tokens.map((token) =>
        token.pinyin ? (
          <ruby key={token.index}>
            {token.char}
            <rt>{token.pinyin}</rt>
          </ruby>
        ) : (
          <span key={token.index}>{token.char}</span>
        ),
      )}
    </span>
  )
}
