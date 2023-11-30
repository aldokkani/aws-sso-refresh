import { program } from 'commander';

program
  .option(
    '--refresh-every <refresh-every>',
    'Refresh every [frequency][unit] e.g. 5s, 1 minute, 2h',
    '20m',
  )
  .option('--profile-sso <profile-sso>', 'AWS SSO profile name', 'default')
  .option(
    '--profile-credentials <profile-credentials>',
    'AWS credentials file profile name',
    'default',
  )
  .option('--headless', 'Start in headless mode', false)
  .option('-t, --timeout <timeout>', 'Timeout in minutes for puppeteer browser to wait', 5)
  .option(
    '--user-data-dir <user-data-dir>',
    'User data directory (browser profile) for puppeteer',
    '/tmp/puppeteer',
  )
  .option(
    '--aws-credentials-file <aws-credentials-file>',
    'AWS credentials file path',
    `${process.env.HOME}/.aws/credentials`,
  );

program.parse();

export default program.opts();
