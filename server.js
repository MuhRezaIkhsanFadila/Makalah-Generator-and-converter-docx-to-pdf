const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { Document, Packer, Paragraph, HeadingLevel, AlignmentType } = require('docx');
const PDFDocument = require('pdfkit');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');
const path = require('path');

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 5173;

const defaultMakalahPayload = {
  title: 'Makalah Teknologi Informasi',
  tema: 'Perkembangan teknologi informasi di lingkungan kampus dan dampaknya terhadap pembelajaran.',
  rumusanMasalah: 'Bagaimana inovasi digital dapat meningkatkan pengalaman belajar mahasiswa?',
  tujuan: 'Memberikan gambaran strategi pemanfaatan teknologi informasi untuk mendukung proses belajar-mengajar yang adaptif.',
  kataKunci: ['teknologi informasi', 'mahasiswa', 'pembelajaran digital'],
  isiRingkas: 'Analisis singkat mengenai tantangan, peluang, dan penerapan praktis teknologi di lingkungan UNISKA.',
  penutup: 'Integrasi teknologi perlu disertai literasi digital dan kolaborasi lintas pihak agar berdampak nyata.',
  daftarPustaka: [
    'Sugiyono. (2022). Metode Penelitian Pendidikan. Bandung: Alfabeta.',
    'Nasution, S. (2024). Inovasi Digital di Perguruan Tinggi. Jakarta: Prenada.',
  ],
};

function ensureArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(/\r?\n|;/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function buildMakalahSections(payload = {}) {
  const data = { ...defaultMakalahPayload, ...payload };
  const keywords = ensureArray(data.kataKunci);
  const daftarPustaka = ensureArray(data.daftarPustaka).length
    ? ensureArray(data.daftarPustaka)
    : defaultMakalahPayload.daftarPustaka;

  const pembahasan = data.isiRingkas || defaultMakalahPayload.isiRingkas;
  const penutup = data.penutup || defaultMakalahPayload.penutup;

  return {
    data,
    keywords,
    daftarPustaka,
    pembahasan,
    penutup,
  };
}

function buildDocxBuffer(payload) {
  const { data, keywords, daftarPustaka, pembahasan, penutup } = buildMakalahSections(payload);

  const paragraphs = [];

  paragraphs.push(
    new Paragraph({
      text: data.title.toUpperCase(),
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      text: 'Disusun oleh ' + (data.author || 'Tim Penyusun Makalah'),
      spacing: { after: 400 },
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({ text: '' })
  );

  paragraphs.push(
    new Paragraph({ text: 'Kata Kunci: ' + keywords.join(', ') }),
    new Paragraph(' ')
  );

  paragraphs.push(
    new Paragraph({ text: 'BAB I PENDAHULUAN', heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ text: '1.1 Latar Belakang', heading: HeadingLevel.HEADING_2 }),
    new Paragraph(data.tema),
    new Paragraph({ text: '1.2 Rumusan Masalah', heading: HeadingLevel.HEADING_2 }),
    new Paragraph(data.rumusanMasalah),
    new Paragraph({ text: '1.3 Tujuan Penulisan', heading: HeadingLevel.HEADING_2 }),
    new Paragraph(data.tujuan)
  );

  paragraphs.push(
    new Paragraph({ text: 'BAB II PEMBAHASAN', heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ text: '2.1 Gambaran Umum', heading: HeadingLevel.HEADING_2 }),
    new Paragraph(pembahasan),
    new Paragraph({ text: '2.2 Analisis dan Diskusi', heading: HeadingLevel.HEADING_2 }),
    new Paragraph(
      'Analisis dilakukan dengan mengaitkan teori yang relevan, kondisi lapangan di lingkungan kampus, serta kebutuhan mahasiswa generasi digital.'
    ),
    new Paragraph({ text: '2.3 Dampak dan Implementasi', heading: HeadingLevel.HEADING_2 }),
    new Paragraph(
      'Implementasi strategi teknologi perlu memperhatikan kesiapan infrastruktur, literasi digital, dan kolaborasi antar pemangku kepentingan.'
    )
  );

  paragraphs.push(
    new Paragraph({ text: 'BAB III PENUTUP', heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ text: '3.1 Kesimpulan', heading: HeadingLevel.HEADING_2 }),
    new Paragraph(penutup),
    new Paragraph({ text: '3.2 Saran', heading: HeadingLevel.HEADING_2 }),
    new Paragraph(
      'Perlu ada pendampingan berkelanjutan agar pemanfaatan teknologi informasi benar-benar menghadirkan pengalaman belajar yang adaptif, inklusif, dan berkelanjutan.'
    )
  );

  paragraphs.push(new Paragraph({ text: 'DAFTAR PUSTAKA', heading: HeadingLevel.HEADING_1 }));
  daftarPustaka.forEach((item) => {
    paragraphs.push(new Paragraph({ text: item, bullet: { level: 0 } }));
  });

  const doc = new Document({
    creator: 'Makalah Generator',
    title: data.title,
    sections: [
      {
        properties: {},
        children: paragraphs,
      },
    ],
  });

  return Packer.toBuffer(doc);
}

function buildPdfBuffer(payload) {
  const { data, keywords, daftarPustaka, pembahasan, penutup } = buildMakalahSections(payload);
  const doc = new PDFDocument({ margin: 50 });

  const chunks = [];
  return new Promise((resolve, reject) => {
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).text(data.title.toUpperCase(), { align: 'center' });
    doc.moveDown();
    doc.fontSize(11).text('Disusun oleh ' + (data.author || 'Tim Penyusun Makalah'), { align: 'center' });
    doc.moveDown(2);
    doc.fontSize(10).text('Kata Kunci: ' + keywords.join(', '));
    doc.moveDown();

    function heading1(text) {
      doc.moveDown();
      doc.fontSize(13).fillColor('#000').text(text, { align: 'left' });
      doc.moveDown(0.3);
    }

    function heading2(text) {
      doc.fontSize(11.5).fillColor('#111').text(text, { align: 'left' });
      doc.moveDown(0.2);
    }

    function body(text) {
      doc.fontSize(10.5).fillColor('#222').text(text, { align: 'justify' });
      doc.moveDown(0.5);
    }

    heading1('BAB I PENDAHULUAN');
    heading2('1.1 Latar Belakang');
    body(data.tema);
    heading2('1.2 Rumusan Masalah');
    body(data.rumusanMasalah);
    heading2('1.3 Tujuan Penulisan');
    body(data.tujuan);

    heading1('BAB II PEMBAHASAN');
    heading2('2.1 Gambaran Umum');
    body(pembahasan);
    heading2('2.2 Analisis dan Diskusi');
    body(
      'Analisis menguraikan peluang, tantangan, dan solusi konkret yang dapat diterapkan di lingkungan perguruan tinggi. Pendekatan kolaboratif dan berbasis data menjadi kunci.'
    );
    heading2('2.3 Dampak dan Implementasi');
    body(
      'Implementasi membutuhkan roadmap yang jelas, indikator keberhasilan, serta dukungan dari seluruh sivitas akademika agar manfaatnya berkelanjutan.'
    );

    heading1('BAB III PENUTUP');
    heading2('3.1 Kesimpulan');
    body(penutup);
    heading2('3.2 Saran');
    body(
      'Institusi perlu mendorong budaya belajar yang adaptif, menyediakan pelatihan literasi digital, dan membuka ruang eksperimen bagi mahasiswa.'
    );

    heading1('DAFTAR PUSTAKA');
    daftarPustaka.forEach((item, index) => {
      doc.fontSize(10.5).text(`${index + 1}. ${item}`, { align: 'left' });
      doc.moveDown(0.3);
    });

    doc.end();
  });
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/generate', async (req, res) => {
  try {
    const { format = 'docx', ...payload } = req.body || {};
    const safeFormat = ['docx', 'pdf'].includes(format.toLowerCase()) ? format.toLowerCase() : 'docx';

    if (safeFormat === 'docx') {
      const buffer = await buildDocxBuffer(payload);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', 'attachment; filename="makalah-generator.docx"');
      return res.send(buffer);
    }

    const pdfBuffer = await buildPdfBuffer(payload);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="makalah-generator.pdf"');
    return res.send(pdfBuffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal membuat makalah.' });
  }
});

app.post('/api/convert/pdf-to-docx', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'File PDF wajib diunggah.' });
    }

    const data = await pdfParse(req.file.buffer);
    const text = data.text || 'Tidak ada konten yang dapat diambil.';

    const doc = new Document();
    const paragraphs = text
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => new Paragraph(line));

    doc.addSection({ children: paragraphs.length ? paragraphs : [new Paragraph(text)] });

    const buffer = await Packer.toBuffer(doc);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="konversi.pdf.docx"');
    res.send(buffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Konversi PDF ke DOCX gagal.' });
  }
});

app.post('/api/convert/docx-to-pdf', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'File DOCX wajib diunggah.' });
    }

    const result = await mammoth.extractRawText({ buffer: req.file.buffer });
    const text = result.value || 'Tidak ada konten yang dapat diambil.';

    const pdfDoc = new PDFDocument({ margin: 50 });
    const chunks = [];

    pdfDoc.on('data', (chunk) => chunks.push(chunk));
    pdfDoc.on('end', () => {
      const buffer = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="konversi.docx.pdf"');
      res.send(buffer);
    });

    pdfDoc.on('error', (err) => {
      console.error(err);
      res.status(500).json({ message: 'Konversi DOCX ke PDF gagal.' });
    });

    pdfDoc.fontSize(11).text(text, { align: 'justify' });
    pdfDoc.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Terjadi kesalahan saat konversi.' });
  }
});

app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
  next();
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Makalah Generator server berjalan di http://localhost:${PORT}`);
  });
}

module.exports = app;
