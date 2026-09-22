# ProtonDB engine for Degoog

This is a standalone Degoog **Store repository** containing one real search engine, **ProtonDB**. It creates a dedicated `Games` search tab (the label can be changed in Degoog settings).

For every game search result it provides:

- Game name
- Direct `https://www.protondb.com/app/<Steam App ID>` link
- Steam App ID
- Release year when SteamDB has one
- Current ProtonDB community tier and report count when the ProtonDB summary endpoint responds

The browser never contacts ProtonDB or SteamDB directly: Degoog makes the requests server-side (`isClientExposed = false`).

## How the engine gets data

1. **Game discovery:** ProtonDB's current public web client searches SteamDB through `https://www.protondb.com/proxy/steamdb2/query`. The engine sends the same JSON query shape and restricts results to `appType:Game`.
2. **Compatibility tier:** for each returned Steam App ID it asks ProtonDB's current public summary endpoint: `https://www.protondb.com/api/v1/reports/summaries/<appid>.json`.

The summary request is deliberately best-effort. A result never disappears merely because a game has no reports, a rating request fails, or ProtonDB is temporarily slow. Successful summaries are cached in process for five minutes.

Neither endpoint is presented by ProtonDB as a versioned public developer API. The repository therefore contains no copied API key and no promise that the search proxy will remain unchanged. The summary endpoint and the proxy were both verified against the current ProtonDB web application when this repository was produced.

## Install through `Settings → Store → Add repository`

The Store installs from a Git repository, so first publish this entire folder to a Git host you trust. GitHub, Codeberg, GitLab, or a self-hosted Git service work. The repository root must be the folder containing this `package.json`.

1. Create a new **public** Git repository, for example `degoog-protondb-extension`.
2. Upload the contents of this folder, preserving the paths exactly. Do not put the folder inside another directory in the repository.
3. Copy the repository's normal HTTPS clone URL, for example `https://github.com/your-name/degoog-protondb-extension.git`.
4. In Degoog, open **Settings → Store** and choose **Add repository**.
5. Paste that clone URL and save. Review the repository details Degoog shows; store extensions run server-side code, so install only repositories you control or have reviewed.
6. In the newly added repository, find **ProtonDB** under **Engines** and select **Install**.
7. Open **Settings → Engines**, enable **ProtonDB**, and run a search such as `Elden Ring`.
8. Select the **Games** tab. A normal web search tab will not contain ProtonDB results because this engine intentionally uses its own result type.

No API key or additional service is required. If the Store reports that an engine needs a newer Degoog release, update Degoog to at least `0.19.0`; this engine follows the current store engine layout used by Degoog's official extensions.

## Local verification

With a current Node.js installation:

```sh
npm run check
npm test
```

The tests mock all network requests. They verify the store-facing engine module, the game-only search filter, result mapping, direct ProtonDB URL, successful tier formatting, and the no-rating fallback.

## Repository layout

```text
package.json                       Store catalog / repository manifest
engines/protondb/index.js          Degoog engine implementation
engines/protondb/author.json       Store author metadata
test/protondb-engine.test.js       Offline unit tests
```

## Updating when ProtonDB changes

If searches stop returning results, first check the two endpoints in the **How the engine gets data** section. The implementation keeps the only two endpoint constants at the top of `engines/protondb/index.js`; update those, increment the engine version in root `package.json`, run the local checks, push the commit, then use Degoog's Store update action.
