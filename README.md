# rxjs-tools

Tooling for working with RXJS

## Getting started

In order to be able to publish the NPM package you will need to add your GitLab API token (API Access) via the following command

```cmd
npm config set -- //gitlab.com/api/v4/projects/38260126/packages/npm/:_authToken $AUTH_TOKEN$
```

Where `$AUTH_TOKEN$` is your GitLab API token

You will also need to add the following for package download:

```cmd
npm config set -- //gitlab.com/api/v4/packages/npm/:_authToken $AUTH_TOKEN$
```
