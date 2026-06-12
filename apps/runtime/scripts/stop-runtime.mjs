const port = process.env.PORT ?? '3000';
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 5000);

fetch(`http://127.0.0.1:${port}/runtime/stop`, {
  method: 'POST',
  signal: controller.signal,
})
  .then(async (response) => {
    const body = await response.text();
    console.log(body || 'Runtime parando.');
    process.exit(response.ok ? 0 : 1);
  })
  .catch((error) => {
    const code = error?.cause?.code ?? error?.code;

    if (code === 'ECONNREFUSED') {
      console.log('Runtime não está em execução.');
      process.exit(0);
    }

    if (error?.name === 'AbortError') {
      console.error('Tempo limite ao parar runtime.');
      process.exit(1);
    }

    console.error(error?.message ?? 'Falha ao parar runtime.');
    process.exit(1);
  })
  .finally(() => clearTimeout(timeout));
