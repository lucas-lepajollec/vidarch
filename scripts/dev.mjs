import concurrently from 'concurrently';

const lanMode = process.argv.includes('--lan');
const bindHost = lanMode ? '0.0.0.0' : '127.0.0.1';
const sharedEnv = {
  ...process.env,
  HOST: bindHost,
  VIDARCH_DEV_HOST: bindHost,
  VIDARCH_DEV_MODE: '1',
};

console.log(lanMode
  ? 'VidArch development mode: LAN access enabled.'
  : 'VidArch development mode: local access only. Use npm run dev:lan to expose it on your network.');

const { result } = concurrently([
  {
    command: 'npm run dev:server',
    name: 'SERVER',
    prefixColor: 'cyan',
    env: sharedEnv,
  },
  {
    command: 'node scripts/wait-for-server.mjs && npm --prefix client run dev',
    name: 'CLIENT',
    prefixColor: 'magenta',
    env: sharedEnv,
  },
], {
  handleInput: true,
  killOthersOn: ['failure'],
  prefix: 'name',
});

try {
  await result;
} catch (events) {
  const expectedStop = Array.isArray(events) && events.every((event) =>
    event.killed || event.exitCode === 0 || event.signal === 'SIGINT'
  );
  if (!expectedStop) process.exitCode = 1;
}
