const app = require('./server');

async function run() {
  const server = app.listen(5174, () => console.log('Test server on 5174'));

  try {
    const payload = {
      format: 'docx',
      title: 'Uji Coba',
      tema: 'Tema singkat',
      rumusanMasalah: 'Rumusan',
      tujuan: 'Tujuan',
      kataKunci: 'uji, coba',
      isiRingkas: 'isi',
      penutup: 'penutup',
      daftarPustaka: 'Penulis. (2025). Judul. Kota: Penerbit.'
    };

    const response = await fetch('http://localhost:5174/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    console.log('Status:', response.status, response.statusText);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const text = await response.text();
      console.error('Body:', text);
      return;
    }

    const arrayBuffer = await response.arrayBuffer();
    console.log('Received bytes:', arrayBuffer.byteLength);
  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    server.close();
  }
}

run();
