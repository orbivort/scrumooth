# Third-Party Notices

This document contains the license information for third-party packages used in the Scrumooth project.

**Project:** Scrumooth - Agile Scrum Lifecycle Management System
**License:** Apache-2.0
**Last Updated:** September 13, 2026

---

## Table of Contents

1. [Backend Production Dependencies](#backend-production-dependencies)
2. [Backend Development Dependencies](#backend-development-dependencies)
3. [Frontend Production Dependencies](#frontend-production-dependencies)
4. [Frontend Development Dependencies](#frontend-development-dependencies)
5. [Root Workspace Dependencies](#root-workspace-dependencies)
6. [Shared Dependencies (@scrumooth/shared)](#shared-dependencies-scrumoothshared)
7. [Runtime & Toolchain (Engines)](#runtime--toolchain-engines)
8. [Font Assets](#font-assets)
9. [License Texts](#license-texts)
10. [License Summary](#license-summary)
11. [Compliance Statement](#compliance-statement)

---

## Backend Production Dependencies

| Dependency Name           | Version | License Type | Copyright Holder              | Source/Repository URL                                              |
| ------------------------- | ------- | ------------ | ----------------------------- | ------------------------------------------------------------------ |
| @prisma/adapter-pg        | 7.9.1   | Apache-2.0   | Prisma Data, Inc.             | https://github.com/prisma/prisma                                   |
| @prisma/client            | 7.9.1   | Apache-2.0   | Prisma Data, Inc.             | https://github.com/prisma/prisma                                   |
| bcrypt                    | 6.0.0   | MIT          | Nick Campbell                 | https://github.com/kelektiv/node.bcrypt.js                         |
| compression               | 1.8.2   | MIT          | Jonathan Ong                  | https://github.com/expressjs/compression                           |
| cookie-parser             | 1.4.7   | MIT          | TJ Holowaychuk                | https://github.com/expressjs/cookie-parser                         |
| cors                      | 2.8.6   | MIT          | Troy Goode                    | https://github.com/expressjs/cors                                  |
| dotenv                    | 17.4.2  | BSD-2-Clause | Scott Motte                   | https://github.com/motdotla/dotenv                                 |
| express                   | 5.2.1   | MIT          | TJ Holowaychuk                | https://github.com/expressjs/express                               |
| express-rate-limit        | 8.6.2   | MIT          | Nathan Friedly                | https://github.com/express-rate-limit/express-rate-limit           |
| helmet                    | 8.3.0   | MIT          | Evan Hahn                     | https://github.com/helmetjs/helmet                                 |
| i18next                   | 26.3.6  | MIT          | i18next                       | https://github.com/i18next/i18next                                 |
| intl-pluralrules          | 2.0.1   | ISC          | Eemeli Aro                    | https://github.com/eemeli/intl-pluralrules                         |
| jsonwebtoken              | 9.0.3   | MIT          | Auth0, Inc.                   | https://github.com/auth0/node-jsonwebtoken                         |
| node-cron                 | 4.6.0   | MIT          | Lucas Merencia                | https://github.com/merencia/node-cron                              |
| nodemailer                | 9.1.1   | MIT-0        | Andris Reinman                | https://github.com/nodemailer/nodemailer                           |
| resolve-accept-language   | 3.2.2   | MIT          | Nicolas Bouvrette             | https://github.com/resolve-accept-language/resolve-accept-language |
| sanitize-html             | 2.17.7  | MIT          | Apostrophe Technologies, Inc. | https://github.com/apostrophecms/sanitize-html                     |
| uuid                      | 14.0.1  | MIT          | uuidjs                        | https://github.com/uuidjs/uuid                                     |
| winston                   | 3.19.0  | MIT          | Charlie Robbins               | https://github.com/winstonjs/winston                               |
| winston-daily-rotate-file | 5.0.0   | MIT          | Matt Hamann                   | https://github.com/winstonjs/winston-daily-rotate-file             |
| zod                       | 4.4.3   | MIT          | Colin McDonnell               | https://github.com/colinhacks/zod                                  |

---

## Backend Development Dependencies

| Dependency Name                  | Version | License Type | Copyright Holder      | Source/Repository URL                                  |
| -------------------------------- | ------- | ------------ | --------------------- | ------------------------------------------------------ |
| @eslint/js                       | 10.0.1  | MIT          | OpenJS Foundation     | https://github.com/eslint/eslint                       |
| @faker-js/faker                  | 10.5.0  | MIT          | FakerJS               | https://github.com/faker-js/faker                      |
| @types/bcrypt                    | 6.0.0   | MIT          | DefinitelyTyped       | https://github.com/DefinitelyTyped/DefinitelyTyped     |
| @types/compression               | 1.8.1   | MIT          | DefinitelyTyped       | https://github.com/DefinitelyTyped/DefinitelyTyped     |
| @types/cookie-parser             | 1.4.10  | MIT          | DefinitelyTyped       | https://github.com/DefinitelyTyped/DefinitelyTyped     |
| @types/cors                      | 2.8.19  | MIT          | DefinitelyTyped       | https://github.com/DefinitelyTyped/DefinitelyTyped     |
| @types/express                   | 5.0.6   | MIT          | DefinitelyTyped       | https://github.com/DefinitelyTyped/DefinitelyTyped     |
| @types/jsonwebtoken              | 9.0.10  | MIT          | DefinitelyTyped       | https://github.com/DefinitelyTyped/DefinitelyTyped     |
| @types/node                      | 24.13.3 | MIT          | DefinitelyTyped       | https://github.com/DefinitelyTyped/DefinitelyTyped     |
| @types/node-cron                 | 3.0.11  | MIT          | DefinitelyTyped       | https://github.com/DefinitelyTyped/DefinitelyTyped     |
| @types/nodemailer                | 8.0.1   | MIT          | DefinitelyTyped       | https://github.com/DefinitelyTyped/DefinitelyTyped     |
| @types/sanitize-html             | 2.16.1  | MIT          | DefinitelyTyped       | https://github.com/DefinitelyTyped/DefinitelyTyped     |
| @types/supertest                 | 7.2.1   | MIT          | DefinitelyTyped       | https://github.com/DefinitelyTyped/DefinitelyTyped     |
| @typescript-eslint/eslint-plugin | 8.67.0  | MIT          | TypeScript ESLint     | https://github.com/typescript-eslint/typescript-eslint |
| @typescript-eslint/parser        | 8.67.0  | MIT          | TypeScript ESLint     | https://github.com/typescript-eslint/typescript-eslint |
| @vitest/coverage-v8              | 4.1.11  | MIT          | Vladimir Sheremet     | https://github.com/vitest-dev/vitest                   |
| cross-env                        | 10.1.0  | MIT          | Kent C. Dodds         | https://github.com/kentcdodds/cross-env                |
| eslint                           | 10.8.1  | MIT          | OpenJS Foundation     | https://github.com/eslint/eslint                       |
| eslint-config-prettier           | 10.1.8  | MIT          | Simon Lydell          | https://github.com/prettier/eslint-config-prettier     |
| eslint-plugin-unicorn            | 64.0.0  | MIT          | Sindre Sorhus         | https://github.com/sindresorhus/eslint-plugin-unicorn  |
| globals                          | 17.11.0 | MIT          | Sindre Sorhus         | https://github.com/sindresorhus/globals                |
| prettier                         | 3.9.6   | MIT          | Prettier              | https://github.com/prettier/prettier                   |
| prisma                           | 7.9.1   | Apache-2.0   | Prisma Data, Inc.     | https://github.com/prisma/prisma                       |
| rimraf                           | 6.1.3   | MIT          | Isaac Z. Schlueter    | https://github.com/isaacs/rimraf                       |
| supertest                        | 7.2.2   | MIT          | TJ Holowaychuk        | https://github.com/ladjs/supertest                     |
| tsx                              | 4.23.12 | MIT          | Hiroki Osame          | https://github.com/privatenumber/tsx                   |
| typescript                       | 6.0.3   | Apache-2.0   | Microsoft Corporation | https://github.com/microsoft/TypeScript                |
| vitest                           | 4.1.11  | MIT          | Vladimir Sheremet     | https://github.com/vitest-dev/vitest                   |

---

## Frontend Production Dependencies

| Dependency Name                  | Version | License Type | Copyright Holder       | Source/Repository URL                                       |
| -------------------------------- | ------- | ------------ | ---------------------- | ----------------------------------------------------------- |
| @tanstack/react-query            | 5.101.4 | MIT          | Tanner Linsley         | https://github.com/TanStack/query                           |
| @tanstack/react-virtual          | 3.14.9  | MIT          | Tanner Linsley         | https://github.com/TanStack/virtual                         |
| axios                            | 1.19.0  | MIT          | Matt Zabriskie         | https://github.com/axios/axios                              |
| chart.js                         | 4.5.1   | MIT          | Chart.js Contributors  | https://github.com/chartjs/Chart.js                         |
| date-fns                         | 4.4.0   | MIT          | Sasha Koss, Lesha Koss | https://github.com/date-fns/date-fns                        |
| i18next                          | 26.3.6  | MIT          | i18next                | https://github.com/i18next/i18next                          |
| i18next-browser-languagedetector | 8.2.1   | MIT          | i18next                | https://github.com/i18next/i18next-browser-languageDetector |
| i18next-http-backend             | 3.0.6   | MIT          | i18next                | https://github.com/i18next/i18next-http-backend             |
| intl-pluralrules                 | 2.0.1   | ISC          | Eemeli Aro             | https://github.com/eemeli/intl-pluralrules                  |
| react                            | 19.2.8  | MIT          | Meta Platforms, Inc.   | https://github.com/facebook/react                           |
| react-chartjs-2                  | 5.3.1   | MIT          | Jeremy Ayerst          | https://github.com/reactchartjs/react-chartjs-2             |
| react-dom                        | 19.2.8  | MIT          | Meta Platforms, Inc.   | https://github.com/facebook/react                           |
| react-i18next                    | 15.7.0  | MIT          | i18next                | https://github.com/i18next/react-i18next                    |
| react-markdown                   | 10.1.0  | MIT          | Titus Wormer           | https://github.com/remarkjs/react-markdown                  |
| react-router                     | 8.3.0   | MIT          | Remix Software, Inc.   | https://github.com/remix-run/react-router                   |
| rehype-sanitize                  | 6.0.0   | MIT          | Titus Wormer           | https://github.com/rehypejs/rehype-sanitize                 |
| remark-gfm                       | 4.0.1   | MIT          | Titus Wormer           | https://github.com/remarkjs/remark-gfm                      |
| zustand                          | 5.0.15  | MIT          | Paul Henschel          | https://github.com/pmndrs/zustand                           |

---

## Frontend Development Dependencies

| Dependency Name             | Version | License Type | Copyright Holder           | Source/Repository URL                                    |
| --------------------------- | ------- | ------------ | -------------------------- | -------------------------------------------------------- |
| @axe-core/playwright        | 4.13.0  | MIT          | Deque Systems, Inc.        | https://github.com/dequelabs/axe-core-npm                |
| @eslint/js                  | 10.0.1  | MIT          | OpenJS Foundation          | https://github.com/eslint/eslint                         |
| @playwright/test            | 1.62.1  | Apache-2.0   | Microsoft Corporation      | https://github.com/microsoft/playwright                  |
| @testing-library/jest-dom   | 6.10.0  | MIT          | Testing Library            | https://github.com/testing-library/jest-dom              |
| @testing-library/react      | 16.3.2  | MIT          | Testing Library            | https://github.com/testing-library/react-testing-library |
| @testing-library/user-event | 14.6.4  | MIT          | Testing Library            | https://github.com/testing-library/user-event            |
| @types/node                 | 24.13.3 | MIT          | DefinitelyTyped            | https://github.com/DefinitelyTyped/DefinitelyTyped       |
| @types/react                | 19.2.18 | MIT          | DefinitelyTyped            | https://github.com/DefinitelyTyped/DefinitelyTyped       |
| @types/react-dom            | 19.2.4  | MIT          | DefinitelyTyped            | https://github.com/DefinitelyTyped/DefinitelyTyped       |
| @vitejs/plugin-react        | 6.0.5   | MIT          | Vite                       | https://github.com/vitejs/vite-plugin-react              |
| @vitest/coverage-v8         | 4.1.11  | MIT          | Vladimir Sheremet          | https://github.com/vitest-dev/vitest                     |
| @vitest/ui                  | 4.1.11  | MIT          | Vladimir Sheremet          | https://github.com/vitest-dev/vitest                     |
| cross-env                   | 10.1.0  | MIT          | Kent C. Dodds              | https://github.com/kentcdodds/cross-env                  |
| eslint                      | 10.8.1  | MIT          | OpenJS Foundation          | https://github.com/eslint/eslint                         |
| eslint-config-prettier      | 10.1.8  | MIT          | Simon Lydell               | https://github.com/prettier/eslint-config-prettier       |
| eslint-plugin-react         | 7.37.5  | MIT          | Yannick Croissant          | https://github.com/jsx-eslint/eslint-plugin-react        |
| globals                     | 17.11.0 | MIT          | Sindre Sorhus              | https://github.com/sindresorhus/globals                  |
| i18next-cli                 | 1.69.0  | MIT          | i18next                    | https://github.com/i18next/i18next-cli                   |
| jsdom                       | 29.1.1  | MIT          | Elijah Insua               | https://github.com/jsdom/jsdom                           |
| prettier                    | 3.9.6   | MIT          | Prettier                   | https://github.com/prettier/prettier                     |
| rimraf                      | 6.1.3   | MIT          | Isaac Z. Schlueter         | https://github.com/isaacs/rimraf                         |
| rollup-plugin-visualizer    | 7.1.1   | MIT          | Denis Bardadym             | https://github.com/btd/rollup-plugin-visualizer          |
| stylelint                   | 17.14.1 | MIT          | stylelint                  | https://github.com/stylelint/stylelint                   |
| stylelint-config-standard   | 40.0.0  | MIT          | stylelint                  | https://github.com/stylelint/stylelint-config-standard   |
| tsx                         | 4.23.12 | MIT          | Hiroki Osame               | https://github.com/privatenumber/tsx                     |
| typescript                  | 6.0.3   | Apache-2.0   | Microsoft Corporation      | https://github.com/microsoft/TypeScript                  |
| typescript-eslint           | 8.67.0  | MIT          | TypeScript ESLint          | https://github.com/typescript-eslint/typescript-eslint   |
| vi-axe                      | 1.0.0   | MIT          | Chan Zuckerberg Initiative | https://github.com/chanzuckerberg/vi-axe                 |
| vite                        | 8.2.1   | MIT          | Vite                       | https://github.com/vitejs/vite                           |
| vitest                      | 4.1.11  | MIT          | Vladimir Sheremet          | https://github.com/vitest-dev/vitest                     |

---

## Root Workspace Dependencies

| Dependency Name                           | Version | License Type | Copyright Holder       | Source/Repository URL                                                 |
| ----------------------------------------- | ------- | ------------ | ---------------------- | --------------------------------------------------------------------- |
| @commitlint/cli                           | 21.2.2  | MIT          | conventional-changelog | https://github.com/conventional-changelog/commitlint                  |
| @commitlint/config-conventional           | 21.2.2  | MIT          | conventional-changelog | https://github.com/conventional-changelog/commitlint                  |
| @eslint/js                                | 10.0.1  | MIT          | OpenJS Foundation      | https://github.com/eslint/eslint                                      |
| @typescript-eslint/eslint-plugin          | 8.67.0  | MIT          | TypeScript ESLint      | https://github.com/typescript-eslint/typescript-eslint                |
| @typescript-eslint/parser                 | 8.67.0  | MIT          | TypeScript ESLint      | https://github.com/typescript-eslint/typescript-eslint                |
| concurrently                              | 10.0.4  | MIT          | Kimmo Brunfeldt        | https://github.com/open-cli-tools/concurrently                        |
| dotenv-cli                                | 11.0.0  | MIT          | Scott Donaldson        | https://github.com/entropitor/dotenv-cli                              |
| entities                                  | 8.0.0   | MIT          | Felix Böhm             | https://github.com/fb55/entities                                      |
| eslint                                    | 10.8.1  | MIT          | OpenJS Foundation      | https://github.com/eslint/eslint                                      |
| eslint-config-prettier                    | 10.1.8  | MIT          | Simon Lydell           | https://github.com/prettier/eslint-config-prettier                    |
| eslint-plugin-import-x                    | 4.17.1  | MIT          | un-ts                  | https://github.com/un-ts/eslint-plugin-import-x                       |
| eslint-plugin-formatjs                    | 6.4.19  | MIT          | FormatJS               | https://github.com/formatjs/formatjs                                  |
| eslint-plugin-react                       | 7.37.5  | MIT          | Yannick Croissant      | https://github.com/jsx-eslint/eslint-plugin-react                     |
| eslint-plugin-react-hooks                 | 7.1.1   | MIT          | Meta Platforms, Inc.   | https://github.com/facebook/react                                     |
| eslint-plugin-react-refresh               | 0.5.4   | MIT          | Arnaud Barré           | https://github.com/ArnaudBarre/eslint-plugin-react-refresh            |
| globals                                   | 17.11.0 | MIT          | Sindre Sorhus          | https://github.com/sindresorhus/globals                               |
| husky                                     | 9.1.7   | MIT          | Typicode               | https://github.com/typicode/husky                                     |
| lint-staged                               | 17.3.0  | MIT          | Andrey Okonetchnikov   | https://github.com/lint-staged/lint-staged                            |
| prettier                                  | 3.9.6   | MIT          | Prettier               | https://github.com/prettier/prettier                                  |
| rimraf                                    | 6.1.3   | MIT          | Isaac Z. Schlueter     | https://github.com/isaacs/rimraf                                      |
| stylelint                                 | 17.14.1 | MIT          | stylelint              | https://github.com/stylelint/stylelint                                |
| stylelint-config-standard                 | 40.0.0  | MIT          | stylelint              | https://github.com/stylelint/stylelint-config-standard                |
| stylelint-no-unsupported-browser-features | 8.1.1   | MIT          | Cédric Delpoux         | https://github.com/RJWadley/stylelint-no-unsupported-browser-features |
| typescript                                | 6.0.3   | Apache-2.0   | Microsoft Corporation  | https://github.com/microsoft/TypeScript                               |
| typescript-eslint                         | 8.67.0  | MIT          | TypeScript ESLint      | https://github.com/typescript-eslint/typescript-eslint                |
| vitest                                    | 4.1.11  | MIT          | Vladimir Sheremet      | https://github.com/vitest-dev/vitest                                  |

---

## Shared Dependencies (@scrumooth/shared)

| Dependency Name        | Version | License Type | Copyright Holder       | Source/Repository URL                              |
| ---------------------- | ------- | ------------ | ---------------------- | -------------------------------------------------- |
| @eslint/js             | 10.0.1  | MIT          | OpenJS Foundation      | https://github.com/eslint/eslint                   |
| @types/node            | 24.13.3 | MIT          | DefinitelyTyped        | https://github.com/DefinitelyTyped/DefinitelyTyped |
| @vitest/coverage-v8    | 4.1.11  | MIT          | Vladimir Sheremet      | https://github.com/vitest-dev/vitest               |
| date-fns               | 4.4.0   | MIT          | Sasha Koss, Lesha Koss | https://github.com/date-fns/date-fns               |
| eslint                 | 10.8.1  | MIT          | OpenJS Foundation      | https://github.com/eslint/eslint                   |
| eslint-config-prettier | 10.1.8  | MIT          | Simon Lydell           | https://github.com/prettier/eslint-config-prettier |
| globals                | 17.11.0 | MIT          | Sindre Sorhus          | https://github.com/sindresorhus/globals            |
| prettier               | 3.9.6   | MIT          | Prettier               | https://github.com/prettier/prettier               |
| rimraf                 | 6.1.3   | MIT          | Isaac Z. Schlueter     | https://github.com/isaacs/rimraf                   |
| typescript             | 6.0.3   | Apache-2.0   | Microsoft Corporation  | https://github.com/microsoft/TypeScript            |
| vitest                 | 4.1.11  | MIT          | Vladimir Sheremet      | https://github.com/vitest-dev/vitest               |

---

## Runtime & Toolchain (Engines)

The following runtime engines, build tools, and infrastructure components are used to build, run, and deploy Scrumooth. They are not npm packages and are therefore not listed in the dependency tables above, but they are first-party-consumed third-party software whose licenses should be acknowledged. These versions are pinned in the package manifests (`engines` field), `pnpm-workspace.yaml`, the Dockerfiles, and `docker-compose.yml`.

| Component  | Version       | License Type                    | Copyright Holder                    | Source/Repository URL                | Where It Is Pinned                                            |
| ---------- | ------------- | ------------------------------- | ----------------------------------- | ------------------------------------ | ------------------------------------------------------------- |
| Node.js    | 24.19.0       | MIT                             | OpenJS Foundation                   | https://github.com/nodejs/node       | `package.json` engines, Dockerfiles (`NODE_VERSION`)          |
| pnpm       | 11.21.0       | MIT                             | pnpm Contributors                   | https://github.com/pnpm/pnpm         | `package.json` `packageManager`, Dockerfiles (`PNPM_VERSION`) |
| nginx      | 1.30 (1.30.4) | BSD-2-Clause                    | Nginx, Inc. / Igor Sysoev           | https://nginx.org                    | Frontend Dockerfile (`NGINX_VERSION`)                         |
| PostgreSQL | 18-alpine     | PostgreSQL License (PostgreSQL) | PostgreSQL Global Development Group | https://www.postgresql.org/          | `docker-compose.yml` `postgres` / `backup` services           |
| Caddy      | 2-alpine      | Apache-2.0                      | Matthew Holt and Caddy contributors | https://github.com/caddyserver/caddy | `docker-compose.yml` `caddy` service                          |

> **Note on npm dependency versions:** All npm packages are resolved from the `pnpm-lock.yaml` lockfile, which is the single source of truth for the exact installed versions. The `engines` field in `package.json` (Node.js `^24.19.0`, pnpm `^11.21.0`) and the `packageManager` field define the minimum required toolchain versions, while the Dockerfiles pin the exact build/runtime versions used in production images.

---

## Font Assets

The following font assets are bundled with the frontend application. These are self-hosted locally (in `packages/frontend/src/assets/fonts/`) to remove the external Google Fonts dependency and enable fully offline/air-gapped operation.

| Asset                  | Version | License Type | Copyright Holder          | Source/Repository URL         |
| ---------------------- | ------- | ------------ | ------------------------- | ----------------------------- |
| Inter (variable woff2) | 4.1     | OFL-1.1      | The Inter Project Authors | https://github.com/rsms/inter |

> **Note:** The Inter variable font is distributed under the SIL Open Font License 1.1. The full license text is provided in `packages/frontend/src/assets/fonts/OFL.txt` and reproduced in the [License Texts](#license-texts) section below. OFL-1.1 permits bundling and redistribution with software, provided the license notice is retained and the fonts are not sold on their own. This is compatible with the Apache-2.0 license under which Scrumooth is distributed.

---

## License Texts

### MIT License

```
MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### MIT No Attribution License (MIT-0)

Used by `nodemailer`.

```
MIT No Attribution

Copyright <YEAR> <COPYRIGHT HOLDER>

Permission is hereby granted, free of charge, to any person obtaining a copy of this
software and associated documentation files (the "Software"), to deal in the Software
without restriction, including without limitation the rights to use, copy, modify,
merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF
CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE
OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

### Apache License 2.0

```
Apache License
Version 2.0, January 2004
http://www.apache.org/licenses/

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

### BSD-2-Clause License

```
BSD 2-Clause License

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

### ISC License

```
ISC License

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

### PostgreSQL License

```
PostgreSQL Database Management System
(formerly known as Postgres, then as Postgres95)

Portions Copyright (c) 1996-2026, The PostgreSQL Global Development Group

Portions Copyright (c) 1994, The Regents of the University of California

Permission to use, copy, modify, and distribute this software and its
documentation for any purpose, without fee, and without a written agreement
is hereby granted, provided that the above copyright notice and this
paragraph and the following two paragraphs appear in all copies.

IN NO EVENT SHALL THE UNIVERSITY OF CALIFORNIA BE LIABLE TO ANY PARTY FOR
DIRECT, INDIRECT, SPECIAL, INCIDENTAL, OR CONSEQUENTIAL DAMAGES, INCLUDING
LOST PROFITS, ARISING OUT OF THE USE OF THIS SOFTWARE AND ITS
DOCUMENTATION, EVEN IF THE UNIVERSITY OF CALIFORNIA HAS BEEN ADVISED OF THE
POSSIBILITY OF SUCH DAMAGE.

THE UNIVERSITY OF CALIFORNIA SPECIFICALLY DISCLAIMS ANY WARRANTIES,
INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS FOR A PARTICULAR PURPOSE. THE SOFTWARE PROVIDED HEREUNDER IS ON
AN "AS IS" BASIS, AND THE UNIVERSITY OF CALIFORNIA HAS NO OBLIGATIONS TO
PROVIDE MAINTENANCE, SUPPORT, UPDATES, ENHANCEMENTS, OR MODIFICATIONS.
```

### SIL Open Font License 1.1 (Inter)

```
Copyright 2020 The Inter Project Authors (https://github.com/rsms/inter)

This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is copied below, and is also available with a FAQ at:
https://openfontlicense.org

-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
```

---

## License Summary

| License Type       | Package Count | Percentage |
| ------------------ | ------------- | ---------- |
| MIT                | 124           | 88.6%      |
| Apache-2.0         | 9             | 6.4%       |
| ISC                | 2             | 1.4%       |
| BSD-2-Clause       | 2             | 1.4%       |
| MIT-0              | 1             | 0.7%       |
| OFL-1.1            | 1             | 0.7%       |
| PostgreSQL License | 1             | 0.7%       |

**Counts:** The package counts above cover all direct npm dependencies listed in the dependency tables (134) plus the pinned runtime/toolchain engines (5) and the bundled font asset (1), for a total of 140 listed third-party components. Counts reflect the number of distinct entries in each table; duplicate package names across workspace tables are counted per occurrence.

---

## Compliance Statement

All dependencies listed in this document use OSI-approved open-source licenses that are compatible with the Apache-2.0 license under which Scrumooth is distributed. No copyleft licenses (GPL, LGPL, AGPL) are present in the dependency tree. `MIT-0` (MIT No Attribution), used by `nodemailer`, is the permissive MIT license with the attribution clause removed; it is OSI-approved and adds no obligations beyond those of MIT. The bundled Inter font is distributed under the SIL Open Font License 1.1, which permits bundling and redistribution with software and is compatible with Apache-2.0. The PostgreSQL server is distributed under the permissive PostgreSQL License, and nginx under the BSD-2-Clause license, both compatible with Apache-2.0.

### Transitive Dependencies

This document covers direct dependencies only. For a complete list of all transitive dependencies and their licenses, run:

```bash
pnpm licenses list --json
```

### Runtime & Toolchain Rationale

Node.js, pnpm, nginx, PostgreSQL, and Caddy are third-party software consumed by Scrumooth at build time and/or runtime. Best practice for accurate and complete third-party notices is to acknowledge them in addition to npm dependencies, because:

- **They ship in the production artifacts** (e.g., nginx serves the frontend image; Node.js runs the backend; PostgreSQL and Caddy run as orchestration services in `docker-compose.yml`).
- **They carry their own license obligations** (e.g., the PostgreSQL License and nginx BSD-2-Clause include redistribution/disclaimer clauses).
- **Pin exact versions** in the manifests/Dockerfiles so the notice remains accurate and auditable.

### Updates

This document should be updated whenever:

- New dependencies are added to the project
- Dependencies are updated to new major versions
- License information changes for existing dependencies
- The runtime/toolchain engines (Node.js, pnpm, nginx, PostgreSQL, Caddy) are upgraded

---

**Document Version:** 3.1  
**Generated:** September 13, 2026
