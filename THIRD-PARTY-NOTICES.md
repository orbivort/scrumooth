# Third-Party Notices

This document contains the license information for third-party packages used in the Scrumooth project.

**Project:** Scrumooth — The self-hosted Scrum Guide enforcement layer
**License:** Apache-2.0
**Last Updated:** November 14, 2026

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
| @prisma/adapter-pg        | 7.10.1  | Apache-2.0   | Prisma Data, Inc.             | https://github.com/prisma/prisma                                   |
| @prisma/client            | 7.10.1  | Apache-2.0   | Prisma Data, Inc.             | https://github.com/prisma/prisma                                   |
| bcrypt                    | 6.0.0   | MIT          | Nick Campbell                 | https://github.com/kelektiv/node.bcrypt.js                         |
| compression               | 1.8.2   | MIT          | Jonathan Ong                  | https://github.com/expressjs/compression                           |
| cookie-parser             | 1.4.7   | MIT          | TJ Holowaychuk                | https://github.com/expressjs/cookie-parser                         |
| cors                      | 2.8.6   | MIT          | Troy Goode                    | https://github.com/expressjs/cors                                  |
| dotenv                    | 17.4.2  | BSD-2-Clause | Scott Motte                   | https://github.com/motdotla/dotenv                                 |
| express                   | 5.3.0   | MIT          | TJ Holowaychuk                | https://github.com/expressjs/express                               |
| express-rate-limit        | 8.7.3   | MIT          | Nathan Friedly                | https://github.com/express-rate-limit/express-rate-limit           |
| helmet                    | 8.3.0   | MIT          | Evan Hahn                     | https://github.com/helmetjs/helmet                                 |
| i18next                   | 26.4.2  | MIT          | i18next                       | https://github.com/i18next/i18next                                 |
| intl-pluralrules          | 2.0.1   | ISC          | Eemeli Aro                    | https://github.com/eemeli/intl-pluralrules                         |
| jsonwebtoken              | 9.0.3   | MIT          | Auth0, Inc.                   | https://github.com/auth0/node-jsonwebtoken                         |
| node-cron                 | 4.6.0   | MIT          | Lucas Merencia                | https://github.com/merencia/node-cron                              |
| nodemailer                | 10.4.0  | MIT-0        | Andris Reinman                | https://github.com/nodemailer/nodemailer                           |
| resolve-accept-language   | 3.2.2   | MIT          | Nicolas Bouvrette             | https://github.com/resolve-accept-language/resolve-accept-language |
| sanitize-html             | 2.18.1  | MIT          | Apostrophe Technologies, Inc. | https://github.com/apostrophecms/sanitize-html                     |
| uuid                      | 14.0.3  | MIT          | uuidjs                        | https://github.com/uuidjs/uuid                                     |
| winston                   | 3.19.0  | MIT          | Charlie Robbins               | https://github.com/winstonjs/winston                               |
| winston-daily-rotate-file | 5.0.0   | MIT          | Matt Hamann                   | https://github.com/winstonjs/winston-daily-rotate-file             |
| zod                       | 4.6.7   | MIT          | Colin McDonnell               | https://github.com/colinhacks/zod                                  |

---

## Backend Development Dependencies

| Dependency Name        | Version | License Type  | Copyright Holder      | Source/Repository URL                              |
| ---------------------- | ------- | ------------- | --------------------- | -------------------------------------------------- |
| @eslint/js             | 10.0.1  | MIT           | OpenJS Foundation     | https://github.com/eslint/eslint                   |
| @faker-js/faker        | 10.6.0  | MIT           | FakerJS               | https://github.com/faker-js/faker                  |
| @types/bcrypt          | 6.0.0   | MIT           | DefinitelyTyped       | https://github.com/DefinitelyTyped/DefinitelyTyped |
| @types/compression     | 1.8.1   | MIT           | DefinitelyTyped       | https://github.com/DefinitelyTyped/DefinitelyTyped |
| @types/cookie-parser   | 1.4.10  | MIT           | DefinitelyTyped       | https://github.com/DefinitelyTyped/DefinitelyTyped |
| @types/cors            | 2.8.19  | MIT           | DefinitelyTyped       | https://github.com/DefinitelyTyped/DefinitelyTyped |
| @types/express         | 5.0.6   | MIT           | DefinitelyTyped       | https://github.com/DefinitelyTyped/DefinitelyTyped |
| @types/jsonwebtoken    | 9.0.10  | MIT           | DefinitelyTyped       | https://github.com/DefinitelyTyped/DefinitelyTyped |
| @types/node            | 24.13.3 | MIT           | DefinitelyTyped       | https://github.com/DefinitelyTyped/DefinitelyTyped |
| @types/node-cron       | 3.0.11  | MIT           | DefinitelyTyped       | https://github.com/DefinitelyTyped/DefinitelyTyped |
| @types/sanitize-html   | 2.16.2  | MIT           | DefinitelyTyped       | https://github.com/DefinitelyTyped/DefinitelyTyped |
| @types/supertest       | 7.2.1   | MIT           | DefinitelyTyped       | https://github.com/DefinitelyTyped/DefinitelyTyped |
| @vitest/coverage-v8    | 4.1.12  | MIT           | Vladimir Sheremet     | https://github.com/vitest-dev/vitest               |
| cross-env              | 10.1.0  | MIT           | Kent C. Dodds         | https://github.com/kentcdodds/cross-env            |
| eslint                 | 10.14.0 | MIT           | OpenJS Foundation     | https://github.com/eslint/eslint                   |
| eslint-config-prettier | 10.1.8  | MIT           | Simon Lydell          | https://github.com/prettier/eslint-config-prettier |
| globals                | 17.14.0 | MIT           | Sindre Sorhus         | https://github.com/sindresorhus/globals            |
| prettier               | 3.9.10  | MIT           | Prettier              | https://github.com/prettier/prettier               |
| prisma                 | 7.10.1  | Apache-2.0    | Prisma Data, Inc.     | https://github.com/prisma/prisma                   |
| rimraf                 | 6.1.4   | BlueOak-1.0.0 | Isaac Z. Schlueter    | https://github.com/isaacs/rimraf                   |
| supertest              | 7.3.2   | MIT           | TJ Holowaychuk        | https://github.com/ladjs/supertest                 |
| tsx                    | 4.23.15 | MIT           | Hiroki Osame          | https://github.com/privatenumber/tsx               |
| typescript             | 6.0.3   | Apache-2.0    | Microsoft Corporation | https://github.com/microsoft/TypeScript            |
| vitest                 | 4.1.12  | MIT           | Vladimir Sheremet     | https://github.com/vitest-dev/vitest               |

---

## Frontend Production Dependencies

| Dependency Name                  | Version | License Type | Copyright Holder       | Source/Repository URL                                       |
| -------------------------------- | ------- | ------------ | ---------------------- | ----------------------------------------------------------- |
| @tanstack/react-query            | 5.107.1 | MIT          | Tanner Linsley         | https://github.com/TanStack/query                           |
| @tanstack/react-virtual          | 3.14.26 | MIT          | Tanner Linsley         | https://github.com/TanStack/virtual                         |
| axios                            | 1.21.0  | MIT          | Matt Zabriskie         | https://github.com/axios/axios                              |
| chart.js                         | 4.6.1   | MIT          | Chart.js Contributors  | https://github.com/chartjs/Chart.js                         |
| date-fns                         | 4.4.0   | MIT          | Sasha Koss, Lesha Koss | https://github.com/date-fns/date-fns                        |
| i18next                          | 26.4.2  | MIT          | i18next                | https://github.com/i18next/i18next                          |
| i18next-browser-languagedetector | 8.3.0   | MIT          | i18next                | https://github.com/i18next/i18next-browser-languageDetector |
| i18next-http-backend             | 4.0.10  | MIT          | i18next                | https://github.com/i18next/i18next-http-backend             |
| intl-pluralrules                 | 2.0.1   | ISC          | Eemeli Aro             | https://github.com/eemeli/intl-pluralrules                  |
| react                            | 19.3.1  | MIT          | Meta Platforms, Inc.   | https://github.com/facebook/react                           |
| react-chartjs-2                  | 5.3.1   | MIT          | Jeremy Ayerst          | https://github.com/reactchartjs/react-chartjs-2             |
| react-dom                        | 19.3.1  | MIT          | Meta Platforms, Inc.   | https://github.com/facebook/react                           |
| react-i18next                    | 15.7.0  | MIT          | i18next                | https://github.com/i18next/react-i18next                    |
| react-markdown                   | 10.1.0  | MIT          | Titus Wormer           | https://github.com/remarkjs/react-markdown                  |
| react-router                     | 8.5.1   | MIT          | Remix Software, Inc.   | https://github.com/remix-run/react-router                   |
| rehype-sanitize                  | 6.0.0   | MIT          | Titus Wormer           | https://github.com/rehypejs/rehype-sanitize                 |
| remark-gfm                       | 4.0.1   | MIT          | Titus Wormer           | https://github.com/remarkjs/remark-gfm                      |
| zustand                          | 5.1.0   | MIT          | Paul Henschel          | https://github.com/pmndrs/zustand                           |

---

## Frontend Development Dependencies

| Dependency Name             | Version | License Type  | Copyright Holder      | Source/Repository URL                                    |
| --------------------------- | ------- | ------------- | --------------------- | -------------------------------------------------------- |
| @axe-core/playwright        | 4.14.0  | MPL-2.0       | Deque Systems, Inc.   | https://github.com/dequelabs/axe-core-npm                |
| @eslint/js                  | 10.0.1  | MIT           | OpenJS Foundation     | https://github.com/eslint/eslint                         |
| @playwright/test            | 1.65.0  | Apache-2.0    | Microsoft Corporation | https://github.com/microsoft/playwright                  |
| @testing-library/jest-dom   | 6.10.0  | MIT           | Testing Library       | https://github.com/testing-library/jest-dom              |
| @testing-library/react      | 16.3.3  | MIT           | Testing Library       | https://github.com/testing-library/react-testing-library |
| @testing-library/user-event | 14.6.8  | MIT           | Testing Library       | https://github.com/testing-library/user-event            |
| @types/node                 | 24.13.3 | MIT           | DefinitelyTyped       | https://github.com/DefinitelyTyped/DefinitelyTyped       |
| @types/react                | 19.3.0  | MIT           | DefinitelyTyped       | https://github.com/DefinitelyTyped/DefinitelyTyped       |
| @types/react-dom            | 19.3.0  | MIT           | DefinitelyTyped       | https://github.com/DefinitelyTyped/DefinitelyTyped       |
| @vitejs/plugin-react        | 6.2.1   | MIT           | Vite                  | https://github.com/vitejs/vite-plugin-react              |
| @vitest/coverage-v8         | 4.1.12  | MIT           | Vladimir Sheremet     | https://github.com/vitest-dev/vitest                     |
| @vitest/ui                  | 4.1.12  | MIT           | Vladimir Sheremet     | https://github.com/vitest-dev/vitest                     |
| cross-env                   | 10.1.0  | MIT           | Kent C. Dodds         | https://github.com/kentcdodds/cross-env                  |
| eslint                      | 10.14.0 | MIT           | OpenJS Foundation     | https://github.com/eslint/eslint                         |
| eslint-config-prettier      | 10.1.8  | MIT           | Simon Lydell          | https://github.com/prettier/eslint-config-prettier       |
| eslint-plugin-react         | 7.37.5  | MIT           | Yannick Croissant     | https://github.com/jsx-eslint/eslint-plugin-react        |
| globals                     | 17.14.0 | MIT           | Sindre Sorhus         | https://github.com/sindresorhus/globals                  |
| i18next-cli                 | 1.87.0  | MIT           | i18next               | https://github.com/i18next/i18next-cli                   |
| jsdom                       | 30.1.2  | MIT           | Elijah Insua          | https://github.com/jsdom/jsdom                           |
| msw                         | 2.15.0  | MIT           | Artem Zakharchenko    | https://github.com/mswjs/msw                             |
| prettier                    | 3.9.10  | MIT           | Prettier              | https://github.com/prettier/prettier                     |
| rimraf                      | 6.1.4   | BlueOak-1.0.0 | Isaac Z. Schlueter    | https://github.com/isaacs/rimraf                         |
| rollup-plugin-visualizer    | 7.1.2   | MIT           | Denis Bardadym        | https://github.com/btd/rollup-plugin-visualizer          |
| stylelint                   | 17.16.0 | MIT           | stylelint             | https://github.com/stylelint/stylelint                   |
| stylelint-config-standard   | 40.0.0  | MIT           | stylelint             | https://github.com/stylelint/stylelint-config-standard   |
| tsx                         | 4.23.15 | MIT           | Hiroki Osame          | https://github.com/privatenumber/tsx                     |
| typescript                  | 6.0.3   | Apache-2.0    | Microsoft Corporation | https://github.com/microsoft/TypeScript                  |
| typescript-eslint           | 8.72.1  | MIT           | TypeScript ESLint     | https://github.com/typescript-eslint/typescript-eslint   |
| vi-axe                      | 1.2.1   | MIT           | Darshan Shah          | https://github.com/dhshah/vi-axe                         |
| vite                        | 8.3.6   | MIT           | Vite                  | https://github.com/vitejs/vite                           |
| vitest                      | 4.1.12  | MIT           | Vladimir Sheremet     | https://github.com/vitest-dev/vitest                     |

---

## Root Workspace Dependencies

| Dependency Name                           | Version | License Type  | Copyright Holder       | Source/Repository URL                                                 |
| ----------------------------------------- | ------- | ------------- | ---------------------- | --------------------------------------------------------------------- |
| @commitlint/cli                           | 21.2.4  | MIT           | conventional-changelog | https://github.com/conventional-changelog/commitlint                  |
| @commitlint/config-conventional           | 21.2.4  | MIT           | conventional-changelog | https://github.com/conventional-changelog/commitlint                  |
| @eslint/js                                | 10.0.1  | MIT           | OpenJS Foundation      | https://github.com/eslint/eslint                                      |
| concurrently                              | 10.0.7  | MIT           | Kimmo Brunfeldt        | https://github.com/open-cli-tools/concurrently                        |
| dotenv-cli                                | 11.1.0  | MIT           | Scott Donaldson        | https://github.com/entropitor/dotenv-cli                              |
| eslint                                    | 10.14.0 | MIT           | OpenJS Foundation      | https://github.com/eslint/eslint                                      |
| eslint-config-prettier                    | 10.1.8  | MIT           | Simon Lydell           | https://github.com/prettier/eslint-config-prettier                    |
| eslint-plugin-import-x                    | 4.18.0  | MIT           | un-ts                  | https://github.com/un-ts/eslint-plugin-import-x                       |
| eslint-plugin-react                       | 7.37.5  | MIT           | Yannick Croissant      | https://github.com/jsx-eslint/eslint-plugin-react                     |
| eslint-plugin-react-hooks                 | 7.1.1   | MIT           | Meta Platforms, Inc.   | https://github.com/facebook/react                                     |
| eslint-plugin-react-refresh               | 0.5.7   | MIT           | Arnaud Barré           | https://github.com/ArnaudBarre/eslint-plugin-react-refresh            |
| eslint-plugin-unicorn                     | 76.0.0  | MIT           | Sindre Sorhus          | https://github.com/sindresorhus/eslint-plugin-unicorn                 |
| globals                                   | 17.14.0 | MIT           | Sindre Sorhus          | https://github.com/sindresorhus/globals                               |
| husky                                     | 9.1.7   | MIT           | Typicode               | https://github.com/typicode/husky                                     |
| lint-staged                               | 17.6.0  | MIT           | Andrey Okonetchnikov   | https://github.com/lint-staged/lint-staged                            |
| prettier                                  | 3.9.10  | MIT           | Prettier               | https://github.com/prettier/prettier                                  |
| rimraf                                    | 6.1.4   | BlueOak-1.0.0 | Isaac Z. Schlueter     | https://github.com/isaacs/rimraf                                      |
| stylelint                                 | 17.16.0 | MIT           | stylelint              | https://github.com/stylelint/stylelint                                |
| stylelint-config-standard                 | 40.0.0  | MIT           | stylelint              | https://github.com/stylelint/stylelint-config-standard                |
| stylelint-no-unsupported-browser-features | 8.1.2   | MIT           | Cédric Delpoux         | https://github.com/RJWadley/stylelint-no-unsupported-browser-features |
| typescript                                | 6.0.3   | Apache-2.0    | Microsoft Corporation  | https://github.com/microsoft/TypeScript                               |
| typescript-eslint                         | 8.72.1  | MIT           | TypeScript ESLint      | https://github.com/typescript-eslint/typescript-eslint                |
| vitest                                    | 4.1.12  | MIT           | Vladimir Sheremet      | https://github.com/vitest-dev/vitest                                  |

---

## Shared Dependencies (@scrumooth/shared)

| Dependency Name        | Version | License Type  | Copyright Holder       | Source/Repository URL                              |
| ---------------------- | ------- | ------------- | ---------------------- | -------------------------------------------------- |
| @eslint/js             | 10.0.1  | MIT           | OpenJS Foundation      | https://github.com/eslint/eslint                   |
| @types/node            | 24.13.3 | MIT           | DefinitelyTyped        | https://github.com/DefinitelyTyped/DefinitelyTyped |
| @vitest/coverage-v8    | 4.1.12  | MIT           | Vladimir Sheremet      | https://github.com/vitest-dev/vitest               |
| date-fns               | 4.4.0   | MIT           | Sasha Koss, Lesha Koss | https://github.com/date-fns/date-fns               |
| eslint                 | 10.14.0 | MIT           | OpenJS Foundation      | https://github.com/eslint/eslint                   |
| eslint-config-prettier | 10.1.8  | MIT           | Simon Lydell           | https://github.com/prettier/eslint-config-prettier |
| globals                | 17.14.0 | MIT           | Sindre Sorhus          | https://github.com/sindresorhus/globals            |
| prettier               | 3.9.10  | MIT           | Prettier               | https://github.com/prettier/prettier               |
| rimraf                 | 6.1.4   | BlueOak-1.0.0 | Isaac Z. Schlueter     | https://github.com/isaacs/rimraf                   |
| typescript             | 6.0.3   | Apache-2.0    | Microsoft Corporation  | https://github.com/microsoft/TypeScript            |
| vitest                 | 4.1.12  | MIT           | Vladimir Sheremet      | https://github.com/vitest-dev/vitest               |

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

### Mozilla Public License 2.0 (MPL-2.0)

Used by `@axe-core/playwright` (development dependency, end-to-end accessibility testing only; not shipped in the production frontend bundle).

```
Mozilla Public License, version 2.0

1. Definitions

1.1. "Contributor"

     means each individual or legal entity that creates, contributes to the
     creation of, or owns Covered Software.

1.2. "Contributor Version"

     means the combination of the Contributions of others (if any) used by a
     Contributor and that particular Contributor's Contribution.

1.3. "Contribution"

     means Covered Software of a particular Contributor.

1.4. "Covered Software"

     means Source Code Form to which the initial Contributor has attached the
     notice in Exhibit A, the Executable Form of such Source Code Form, and
     Modifications of such Source Code Form, in each case including portions
     thereof.

1.5. "Incompatible With Secondary Licenses"
     means

     a. that the initial Contributor has attached the notice described in
        Exhibit B to the Covered Software; or

     b. that the Covered Software was made available under the terms of
        version 1.1 or earlier of the License, but not also under the terms of
        a Secondary License.

1.6. "Executable Form"

     means any form of the work other than Source Code Form.

1.7. "Larger Work"

     means a work that combines Covered Software with other material, in a
     separate file or files, that is not Covered Software.

1.8. "License"

     means this document.

1.9. "Licensable"

     means having the right to grant, to the maximum extent possible, whether
     at the time of the initial grant or subsequently, any and all of the
     rights conveyed by this License.

1.10. "Modifications"

     means any of the following:

     a. any file in Source Code Form that results from an addition to,
        deletion from, or modification of the contents of Covered Software; or

     b. any new file in Source Code Form that contains any Covered Software.

1.11. "Patent Claims" of a Contributor

      means any patent claim(s), including without limitation, method,
      process, and apparatus claims, in any patent Licensable by such
      Contributor that would be infringed, but for the grant of the License,
      by the making, using, selling, offering for sale, having made, import,
      or transfer of either its Contributions or its Contributor Version.

1.12. "Secondary License"

      means either the GNU General Public License, Version 2.0, the GNU Lesser
      General Public License, Version 2.1, the GNU Affero General Public
      License, Version 3.0, or any later versions of those licenses.

1.13. "Source Code Form"

      means the form of the work preferred for making modifications.

1.14. "You" (or "Your")

      means an individual or a legal entity exercising rights under this
      License. For legal entities, "You" includes any entity that controls, is
      controlled by, or is under common control with You. For purposes of this
      definition, "control" means (a) the power, direct or indirect, to cause
      the direction or management of such entity, whether by contract or
      otherwise, or (b) ownership of more than fifty percent (50%) of the
      outstanding shares or beneficial ownership of such entity.


2. License Grants and Conditions

2.1. Grants

     Each Contributor hereby grants You a world-wide, royalty-free,
     non-exclusive license:

     a. under intellectual property rights (other than patent or trademark)
        Licensable by such Contributor to use, reproduce, make available,
        modify, display, perform, distribute, and otherwise exploit its
        Contributions, either on an unmodified basis, with Modifications, or
        as part of a Larger Work; and

     b. under Patent Claims of such Contributor to make, use, sell, offer for
        sale, have made, import, and otherwise transfer either its
        Contributions or its Contributor Version.

2.2. Effective Date

     The licenses granted in Section 2.1 with respect to any Contribution
     become effective for each Contribution on the date the Contributor first
     distributes such Contribution.

2.3. Limitations on Grant Scope

     The licenses granted in this Section 2 are the only rights granted under
     this License. No additional rights or licenses will be implied from the
     distribution or licensing of Covered Software under this License.
     Notwithstanding Section 2.1(b) above, no patent license is granted by a
     Contributor:

     a. for any code that a Contributor has removed from Covered Software; or

     b. for infringements caused by: (i) Your and any other third party's
        modifications of Covered Software, or (ii) the combination of its
        Contributions with other software (except as part of its Contributor
        Version); or

     c. under Patent Claims infringed by Covered Software in the absence of
        its Contributions.

     This License does not grant any rights in the trademarks, service marks,
     or logos of any Contributor (except as may be necessary to comply with
     the notice requirements in Section 3.4).

2.4. Subsequent Licenses

     No Contributor makes additional grants as a result of Your choice to
     distribute the Covered Software under a subsequent version of this
     License (see Section 10.2) or under the terms of a Secondary License (if
     permitted under the terms of Section 3.3).

2.5. Representation

     Each Contributor represents that the Contributor believes its
     Contributions are its original creation(s) or it has sufficient rights to
     grant the rights to its Contributions conveyed by this License.

2.6. Fair Use

     This License is not intended to limit any rights You have under
     applicable copyright doctrines of fair use, fair dealing, or other
     equivalents.

2.7. Conditions

     Sections 3.1, 3.2, 3.3, and 3.4 are conditions of the licenses granted in
     Section 2.1.


3. Responsibilities

3.1. Distribution of Source Form

     All distribution of Covered Software in Source Code Form, including any
     Modifications that You create or to which You contribute, must be under
     the terms of this License. You must inform recipients that the Source
     Code Form of the Covered Software is governed by the terms of this
     License, and how they can obtain a copy of this License. You may not
     attempt to alter or restrict the recipients' rights in the Source Code
     Form.

3.2. Distribution of Executable Form

     If You distribute Covered Software in Executable Form then:

     a. such Covered Software must also be made available in Source Code Form,
        as described in Section 3.1, and You must inform recipients of the
        Executable Form how they can obtain a copy of such Source Code Form by
        reasonable means in a timely manner, at a charge no more than the cost
        of distribution to the recipient; and

     b. You may distribute such Executable Form under the terms of this
        License, or sublicense it under different terms, provided that the
        license for the Executable Form does not attempt to limit or alter the
        recipients' rights in the Source Code Form under this License.

3.3. Distribution of a Larger Work

     You may create and distribute a Larger Work under terms of Your choice,
     provided that You also comply with the requirements of this License for
     the Covered Software. If the Larger Work is a combination of Covered
     Software with a work governed by one or more Secondary Licenses, and the
     Covered Software is not Incompatible With Secondary Licenses, this
     License permits You to additionally distribute such Covered Software
     under the terms of such Secondary License(s), so that the recipient of
     the Larger Work may, at their option, further distribute the Covered
     Software under the terms of either this License or such Secondary
     License(s).

3.4. Notices

     You may not remove or alter the substance of any license notices
     (including copyright notices, patent notices, disclaimers of warranty, or
     limitations of liability) contained within the Source Code Form of the
     Covered Software, except that You may alter any license notices to the
     extent required to remedy known factual inaccuracies.

3.5. Application of Additional Terms

     You may choose to offer, and to charge a fee for, warranty, support,
     indemnity or liability obligations to one or more recipients of Covered
     Software. However, You may do so only on Your own behalf, and not on
     behalf of any Contributor. You must make it absolutely clear that any
     such warranty, support, indemnity, or liability obligation is offered by
     You alone, and You hereby agree to indemnify every Contributor for any
     liability incurred by such Contributor as a result of warranty, support,
     indemnity or liability terms You offer. You may include additional
     disclaimers of warranty and limitations of liability specific to any
     jurisdiction.

4. Inability to Comply Due to Statute or Regulation

   If it is impossible for You to comply with any of the terms of this License
   with respect to some or all of the Covered Software due to statute,
   judicial order, or regulation then You must: (a) comply with the terms of
   this License to the maximum extent possible; and (b) describe the
   limitations and the code they affect. Such description must be placed in a
   text file included with all distributions of the Covered Software under
   this License. Except to the extent prohibited by statute or regulation,
   such description must be sufficiently detailed for a recipient of ordinary
   skill to be able to understand it.

5. Termination

5.1. The rights granted under this License will terminate automatically if You
     fail to comply with any of its terms. However, if You become compliant,
     then the rights granted under this License from a particular Contributor
     are reinstated (a) provisionally, unless and until such Contributor
     explicitly and finally terminates Your grants, and (b) on an ongoing
     basis, if such Contributor fails to notify You of the non-compliance by
     some reasonable means prior to 60 days after You have come back into
     compliance. Moreover, Your grants from a particular Contributor are
     reinstated on an ongoing basis if such Contributor notifies You of the
     non-compliance by some reasonable means, this is the first time You have
     received notice of non-compliance with this License from such
     Contributor, and You become compliant prior to 30 days after Your receipt
     of the notice.

5.2. If You initiate litigation against any entity by asserting a patent
     infringement claim (excluding declaratory judgment actions,
     counter-claims, and cross-claims) alleging that a Contributor Version
     directly or indirectly infringes any patent, then the rights granted to
     You by any and all Contributors for the Covered Software under Section
     2.1 of this License shall terminate.

5.3. In the event of termination under Sections 5.1 or 5.2 above, all end user
     license agreements (excluding distributors and resellers) which have been
     validly granted by You or Your distributors under this License prior to
     termination shall survive termination.

6. Disclaimer of Warranty

   Covered Software is provided under this License on an "as is" basis,
   without warranty of any kind, either expressed, implied, or statutory,
   including, without limitation, warranties that the Covered Software is free
   of defects, merchantable, fit for a particular purpose or non-infringing.
   The entire risk as to the quality and performance of the Covered Software
   is with You. Should any Covered Software prove defective in any respect,
   You (not any Contributor) assume the cost of any necessary servicing,
   repair, or correction. This disclaimer of warranty constitutes an essential
   part of this License. No use of  any Covered Software is authorized under
   this License except under this disclaimer.

7. Limitation of Liability

   Under no circumstances and under no legal theory, whether tort (including
   negligence), contract, or otherwise, shall any Contributor, or anyone who
   distributes Covered Software as permitted above, be liable to You for any
   direct, indirect, special, incidental, or consequential damages of any
   character including, without limitation, damages for lost profits, loss of
   goodwill, work stoppage, computer failure or malfunction, or any and all
   other commercial damages or losses, even if such party shall have been
   informed of the possibility of such damages. This limitation of liability
   shall not apply to liability for death or personal injury resulting from
   such party's negligence to the extent applicable law prohibits such
   limitation. Some jurisdictions do not allow the exclusion or limitation of
   incidental or consequential damages, so this exclusion and limitation may
   not apply to You.

8. Litigation

   Any litigation relating to this License may be brought only in the courts
   of a jurisdiction where the defendant maintains its principal place of
   business and such litigation shall be governed by laws of that
   jurisdiction, without reference to its conflict-of-law provisions. Nothing
   in this Section shall prevent a party's ability to bring cross-claims or
   counter-claims.

9. Miscellaneous

   This License represents the complete agreement concerning the subject
   matter hereof. If any provision of this License is held to be
   unenforceable, such provision shall be reformed only to the extent
   necessary to make it enforceable. Any law or regulation which provides that
   the language of a contract shall be construed against the drafter shall not
   be used to construe this License against a Contributor.


10. Versions of the License

10.1. New Versions

      Mozilla Foundation is the license steward. Except as provided in Section
      10.3, no one other than the license steward has the right to modify or
      publish new versions of this License. Each version will be given a
      distinguishing version number.

10.2. Effect of New Versions

      You may distribute the Covered Software under the terms of the version
      of the License under which You originally received the Covered Software,
      or under the terms of any subsequent version published by the license
      steward.

10.3. Modified Versions

      If you create software not governed by this License, and you want to
      create a new license for such software, you may create and use a
      modified version of this License if you rename the license and remove
      any references to the name of the license steward (except to note that
      such modified license differs from this License).

10.4. Distributing Source Code Form that is Incompatible With Secondary
      Licenses If You choose to distribute Source Code Form that is
      Incompatible With Secondary Licenses under the terms of this version of
      the License, the notice described in Exhibit B of this License must be
      attached.

Exhibit A - Source Code Form License Notice

      This Source Code Form is subject to the
      terms of the Mozilla Public License, v.
      2.0. If a copy of the MPL was not
      distributed with this file, You can
      obtain one at
      http://mozilla.org/MPL/2.0/.

If it is not possible or desirable to put the notice in a particular file,
then You may include the notice in a location (such as a LICENSE file in a
relevant directory) where a recipient would be likely to look for such a
notice.

You may add additional accurate notices of copyright ownership.

Exhibit B - "Incompatible With Secondary Licenses" Notice

      This Source Code Form is "Incompatible
      With Secondary Licenses", as defined by
      the Mozilla Public License, v. 2.0.
```

### Blue Oak Model License 1.0.0

Used by `rimraf` (development/build tooling).

```
# Blue Oak Model License

Version 1.0.0

## Purpose

This license gives everyone as much permission to work with
this software as possible, while protecting contributors
from liability.

## Acceptance

In order to receive this license, you must agree to its
rules.  The rules of this license are both obligations
under that agreement and conditions to your license.
You must not do anything with this software that triggers
a rule that you cannot or will not follow.

## Copyright

Each contributor licenses you to do everything with this
software that would otherwise infringe that contributor's
copyright in it.

## Notices

You must ensure that everyone who gets a copy of
any part of this software from you, with or without
changes, also gets the text of this license or a link to
<https://blueoakcouncil.org/license/1.0.0>.

## Excuse

If anyone notifies you in writing that you have not
complied with [Notices](#notices), you can keep your
license by taking all practical steps to comply within 30
days after the notice.  If you do not do so, your license
ends immediately.

## Patent

Each contributor licenses you to do everything with this
software that would otherwise infringe any patent claims
they can license or become able to license.

## Reliability

No contributor can revoke this license.

## No Liability

***As far as the law allows, this software comes as is,
without any warranty or condition, and no contributor
will be liable to anyone for any damages related to this
software or this license, under any kind of legal claim.***
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
| MIT                | 113           | 84.3%      |
| Apache-2.0         | 9             | 6.7%       |
| BlueOak-1.0.0      | 4             | 3.0%       |
| ISC                | 2             | 1.5%       |
| BSD-2-Clause       | 2             | 1.5%       |
| MPL-2.0            | 1             | 0.7%       |
| MIT-0              | 1             | 0.7%       |
| OFL-1.1            | 1             | 0.7%       |
| PostgreSQL License | 1             | 0.7%       |

**Counts:** The package counts above cover all direct npm dependencies listed in the dependency tables (128) plus the pinned runtime/toolchain engines (5) and the bundled font asset (1), for a total of 134 listed third-party components. Counts reflect the number of distinct entries in each table; duplicate package names across workspace tables are counted per occurrence. Percentage shares are rounded to one decimal place, so they may not sum to exactly 100%. `rimraf` is listed four times (backend, frontend, root, and shared workspaces) and accounts for all four `BlueOak-1.0.0` entries; `@axe-core/playwright` is the single `MPL-2.0` entry.

---

## Compliance Statement

All dependencies listed in this document use open-source licenses that are compatible with the Apache-2.0 license under which Scrumooth is distributed. No GPL, LGPL, or AGPL licenses are present in the direct dependency tree. `MIT-0` (MIT No Attribution), used by `nodemailer`, is the permissive MIT license with the attribution clause removed; it adds no obligations beyond those of MIT. `MPL-2.0`, used by `@axe-core/playwright`, is a file-level (weak) copyleft license: it only requires that modifications to the MPL-covered files themselves be published under MPL-2.0, and it is compatible with Apache-2.0 for unmodified use. The package is a development-only dependency used by the Playwright end-to-end accessibility tests and is not part of the shipped backend runtime or frontend bundle, so no MPL-covered code is distributed in production artifacts. `BlueOak-1.0.0`, used by `rimraf`, is a permissive license from the Blue Oak Council whose only condition is that recipients receive the license text or a link to it; it is used by development/build tooling only. The bundled Inter font is distributed under the SIL Open Font License 1.1, which permits bundling and redistribution with software and is compatible with Apache-2.0. The PostgreSQL server is distributed under the permissive PostgreSQL License, and nginx under the BSD-2-Clause license, both compatible with Apache-2.0.

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
- Dependencies are upgraded to new versions (major, minor, or patch), since every version listed here must match the resolved version in `pnpm-lock.yaml`
- License information changes for existing dependencies
- The runtime/toolchain engines (Node.js, pnpm, nginx, PostgreSQL, Caddy) are upgraded

---

**Document Version:** 3.7  
**Generated:** November 14, 2026
