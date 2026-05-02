# Graph Report - Backend  (2026-05-02)

## Corpus Check
- 20 files · ~7,692 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 138 nodes · 203 edges · 11 communities detected
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 24 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]

## God Nodes (most connected - your core abstractions)
1. `ChatAnalyzer` - 16 edges
2. `YtController` - 9 edges
3. `genClipFileWithMediaPlan()` - 9 edges
4. `httpError()` - 7 edges
5. `loadClipMediaPlan()` - 7 edges
6. `streamVidSegment()` - 7 edges
7. `fmtTimestamp()` - 5 edges
8. `parseClipWindow()` - 5 edges
9. `Redis` - 5 edges
10. `Security and Configuration Tips` - 5 edges

## Surprising Connections (you probably didn't know these)
- `Express API` --semantically_similar_to--> `Expressjs`  [INFERRED] [semantically similar]
  AGENTS.md → readme.md
- `Prisma Schema` --semantically_similar_to--> `Prisma Client`  [INFERRED] [semantically similar]
  AGENTS.md → readme.md
- `MongoDB` --semantically_similar_to--> `mongoDB`  [INFERRED] [semantically similar]
  AGENTS.md → readme.md
- `httpError()` --calls--> `selectMediaFormats()`  [INFERRED]
  src\utils\clip-time-util.mjs → src\utils\yt-util.mjs
- `httpError()` --calls--> `loadClipMediaPlan()`  [INFERRED]
  src\utils\clip-time-util.mjs → src\utils\yt-util.mjs

## Hyperedges (group relationships)
- **Express API Runtime Structure** — AGENTS_src_directory, AGENTS_server_mjs, AGENTS_router_directory, AGENTS_controller_directory, AGENTS_middleware_directory, AGENTS_express_api [EXTRACTED 1.00]
- **Development Command Set** — AGENTS_npm_install, AGENTS_npm_start, AGENTS_prisma_generate, AGENTS_probe_eval, AGENTS_npm_test_placeholder [EXTRACTED 1.00]
- **Local Service Configuration** — AGENTS_mongodb, AGENTS_database_url, AGENTS_redis, AGENTS_om_client_mjs, AGENTS_redis_service_mjs [EXTRACTED 1.00]

## Communities

### Community 0 - "Community 0"
Cohesion: 0.17
Nodes (17): httpError(), parseTimestamp(), buildFfmpegArgs(), createMediaRangeProxy(), decipherMediaUrl(), ffmpegTime(), genClipFile(), genClipFileWithMediaPlan() (+9 more)

### Community 1 - "Community 1"
Cohesion: 0.12
Nodes (20): cert Directory, Chat Analysis, DATABASE_URL, External Test Dependencies, MongoDB, om/client.mjs, output Directory, npx prisma generate (+12 more)

### Community 2 - "Community 2"
Cohesion: 0.14
Nodes (3): RedisMiddleware, YtRouter, RedisService

### Community 3 - "Community 3"
Cohesion: 0.22
Nodes (1): ChatAnalyzer

### Community 4 - "Community 4"
Cohesion: 0.2
Nodes (5): cnvTimestampToMin(), fmtMin(), fmtTimestamp(), normTimestamp(), padTime()

### Community 5 - "Community 5"
Cohesion: 0.27
Nodes (7): clipResponse(), batchStatusCode(), buildBatchClipJobs(), errorResponse(), normalizeBatchClipOffset(), validateBatchClipInput(), validationError()

### Community 6 - "Community 6"
Cohesion: 0.18
Nodes (12): controller Directory, JavaScript ES Module Style, Express API, middleware Directory, Node.js ES Module Backend, npm install, npm start, npm test Placeholder (+4 more)

### Community 7 - "Community 7"
Cohesion: 0.33
Nodes (2): YtController, listenYt()

### Community 8 - "Community 8"
Cohesion: 0.5
Nodes (2): setWordHeatMap(), tokenizeJapanese()

### Community 9 - "Community 9"
Cohesion: 0.5
Nodes (1): CommonMiddleware

### Community 10 - "Community 10"
Cohesion: 1.0
Nodes (1): Chat

## Knowledge Gaps
- **12 isolated node(s):** `Chat`, `src Runtime Source Directory`, `Chat Analysis`, `Redis OM Entities`, `output Directory` (+7 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 3`** (16 nodes): `ChatAnalyzer`, `.analyze()`, `.#buildResult()`, `.#calBaseline()`, `.#calSpikeScore()`, `.constructor()`, `.#formatTimestamp()`, `.#getMatchedWords()`, `.getObj()`, `.#isClippable()`, `.load()`, `.#normalizeWords()`, `.#numberOrDefault()`, `.#rankAndApplyCooldown()`, `.#resolveOptions()`, `.setVideoStartTimestamp()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 7`** (7 nodes): `YtController`, `.analyze()`, `.endListener()`, `.getClip()`, `.listen()`, `.listenCh()`, `listenYt()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 8`** (5 nodes): `data-prc-util.mjs`, `extractWordHeatMap()`, `initTokenizer()`, `setWordHeatMap()`, `tokenizeJapanese()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 9`** (4 nodes): `CommonMiddleware`, `.constructor()`, `.hasRequestBody()`, `common-middleware.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 10`** (2 nodes): `Chat`, `chat.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ChatAnalyzer` connect `Community 3` to `Community 4`?**
  _High betweenness centrality (0.131) - this node is a cross-community bridge._
- **Why does `YtController` connect `Community 7` to `Community 4`, `Community 5`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `genClipFileWithMediaPlan()` (e.g. with `.genClipBatch()` and `httpError()`) actually correct?**
  _`genClipFileWithMediaPlan()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `httpError()` (e.g. with `selectMediaFormats()` and `loadClipMediaPlan()`) actually correct?**
  _`httpError()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `loadClipMediaPlan()` (e.g. with `.genClipBatch()` and `httpError()`) actually correct?**
  _`loadClipMediaPlan()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Chat`, `src Runtime Source Directory`, `Chat Analysis` to the rest of the system?**
  _12 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._