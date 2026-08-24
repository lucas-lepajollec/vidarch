const port = Number.parseInt(process.env.PORT || '2498', 10);
const healthUrl = `http://127.0.0.1:${port}/api/health`;
const deadline = Date.now() + 30_000;
let ready = false;

while (Date.now() < deadline) {
  try {
    const response = await fetch(healthUrl, { signal: AbortSignal.timeout(1_000) });
    if (response.ok) {
      ready = true;
      break;
    }
  } catch {
    // The API is still starting. Keep the client quiet until it is ready.
  }
  await new Promise((resolve) => setTimeout(resolve, 250));
}

if (!ready) {
  console.error(`VidArch API did not become ready at ${healthUrl} within 30 seconds.`);
  process.exitCode = 1;
}
