// Copiar / baixar o documento gerado. Porta copyTextRobusto/slugify/downloads
// (html 2329-2403).

export function copyTextRobusto(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text)
  }
  return new Promise((resolve, reject) => {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.focus()
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      ok ? resolve() : reject(new Error('execCommand falhou'))
    } catch (e) {
      reject(e)
    }
  })
}

export function slugify(text: string): string {
  return (text || 'campanha-boxys')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

export function downloadMarkdown(text: string, titulo: string): void {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = slugify(titulo) + '.md'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function printPdf(contentHtml: string, titulo: string): void {
  const printWindow = window.open('', '_blank')
  if (!printWindow) return
  printWindow.document.write(`
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${titulo || 'Campanha Boxys'}</title>
      <style>
        body{font-family:Georgia,serif;color:#14110F;padding:40px;max-width:800px;margin:0 auto;line-height:1.6;}
        h1,h2,h3{font-family:Georgia,serif;}
        h1{border-bottom:2px solid #14110F;padding-bottom:10px;}
        h2{color:#C4462B;margin-top:32px;}
        strong{color:#14110F;}
      </style>
    </head>
    <body>${contentHtml}</body>
    </html>
  `)
  printWindow.document.close()
  printWindow.focus()
  setTimeout(() => printWindow.print(), 300)
}
