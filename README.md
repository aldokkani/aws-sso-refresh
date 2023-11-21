### Refresh AWS SSO headless-ly in the background

The script uses [puppeteer](https://pptr.dev/) to run headless browser in the background to re-authenticate (by default every 55 minutes) your [AWS SSO Login](https://docs.aws.amazon.com/cli/latest/userguide/sso-configure-profile-token.html#sso-configure-profile-token-auto-sso) and write the newly acquired token to your AWS credentials file (by default ~/.aws/credentials).

**Important!** Only on the first run the script will allow a browser window to login manually in case you need to MFA your AWS account. You can skip this by passing `--headless`.

#### Installation

```
$ git clone git@github.com:aldokkani/aws-sso-refresh.git

$ npm ci
```

#### Start

```
$ npm start
```

Optionally you can specify your non-default AWS account as the following:

```
$ npm start -- --profile-sso dev
$ npm start -- --profile-sso dev --profile-credentials dev

```

#### Customization

```
$ npm run help

Options:
  --refresh-every <refresh-every>                Refresh every [frequency][unit] e.g. 5s, 1 minute, 2h (default: "55m")
  --profile-sso <profile-sso>                    AWS SSO profile name (default: "default")
  --profile-credentials <profile-credentials>    AWS credentials file profile name (default: "default")
  --headless                                     Start in headless mode (default: false)
  -t, --timeout <timeout>                        Timeout in minutes for puppeteer browser to wait (default: 3)
  --user-data-dir <user-data-dir>                User data directory (browser profile) for puppeteer (default: "/tmp/puppeteer")
  --aws-credentials-file <aws-credentials-file>  AWS credentials file path (default: "~/.aws/credentials")
  -h, --help                                     display help for command
```
