// Util de arquivos de referência: lê File → ArquivoRef (base64), porta fileToBase64
// (html 1283-1290) + formatBytes (1260-1264).
import type { ArquivoRef } from '../../types/gerador'

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1] ?? '')
    }
    reader.onerror = () => reject(new Error('Falha ao ler ' + file.name))
    reader.readAsDataURL(file)
  })
}

export async function fileToArquivoRef(file: File): Promise<ArquivoRef> {
  const base64 = await fileToBase64(file)
  return { name: file.name, size: file.size, mediaType: file.type, base64 }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
