/** Drop the quoted history every reply repeats, so each message counts once. */
export const stripQuotedReply = (body: string): string => {
  const lines = body.split(/\r?\n/)
  const cut = lines.findIndex(
    (line) =>
      /^On .+wrote:\s*$/.test(line.trim()) ||
      /^-{2,}\s*Original Message\s*-{2,}/i.test(line.trim()) ||
      /^From: .+/.test(line.trim()),
  )
  return (cut >= 0 ? lines.slice(0, cut) : lines)
    .filter((line) => !line.startsWith('>'))
    .join('\n')
    .trim()
}
