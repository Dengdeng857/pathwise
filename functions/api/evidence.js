import { extractText, getDocumentProxy } from 'unpdf';
import { json } from './_shared.js';

export async function onRequestPost({ request }) {
  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return json({ error: '缺少文件' }, 400);
    const name = file.name || '材料';
    const lower = name.toLowerCase();
    let text = '';
    if (/\.(txt|md|json|csv)$/.test(lower) || file.type.startsWith('text/')) {
      text = await file.text();
    } else if (lower.endsWith('.pdf')) {
      const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
      const result = await extractText(pdf, { mergePages: true });
      text = Array.isArray(result.text) ? result.text.join('\n') : String(result.text || '');
      if (!text.trim()) text = 'PDF 没有可提取文字，可能是扫描件。请上传带文字层的 PDF。';
    } else {
      return json({ error: '线上版当前支持 PDF、TXT、MD、JSON 和 CSV。图片、DOCX 与音频请在本地版解析。' }, 415);
    }
    return json({ filename: name, type: file.type, text: text.slice(0, 30000), bytes: file.size });
  } catch (error) {
    return json({ error: `材料解析失败：${String(error.message || error)}` }, 500);
  }
}
