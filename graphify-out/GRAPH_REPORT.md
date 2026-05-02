# Graph Report - D:/Proj/Backend  (2026-05-02)

## Corpus Check
- Corpus is ~7,085 words - fits in a single context window. You may not need a graph.

## Summary
- 133 nodes · 189 edges · 10 communities detected
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 21 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_YouTube Media Pipeline|YouTube Media Pipeline]]
- [[_COMMUNITY_Infrastructure Configuration|Infrastructure Configuration]]
- [[_COMMUNITY_Redis Cache Middleware|Redis Cache Middleware]]
- [[_COMMUNITY_Chat Analysis Engine|Chat Analysis Engine]]
- [[_COMMUNITY_YouTube Controller Flow|YouTube Controller Flow]]
- [[_COMMUNITY_Clip Batch Generation|Clip Batch Generation]]
- [[_COMMUNITY_Project Structure|Project Structure]]
- [[_COMMUNITY_Routing and Tests|Routing and Tests]]
- [[_COMMUNITY_Request Body Middleware|Request Body Middleware]]
- [[_COMMUNITY_Chat Model|Chat Model]]

## God Nodes (most connected - your core abstractions)
1. `ChatAnalyzer` - 14 edges
2. `YtController` - 9 edges
3. `genClipFileWithMediaPlan()` - 9 edges
4. `httpError()` - 7 edges
5. `loadClipMediaPlan()` - 7 edges
6. `streamVidSegment()` - 7 edges
7. `parseClipWindow()` - 5 edges
8. `Redis` - 5 edges
9. `Security and Configuration Tips` - 5 edges
10. `RedisMiddleware` - 4 edges

## Surprising Connections (you probably didn't know these)
- `Expressjs` --semantically_similar_to--> `Express API`  [INFERRED] [semantically similar]
  readme.md → AGENTS.md
- `Prisma Client` --semantically_similar_to--> `Prisma Schema`  [INFERRED] [semantically similar]
  readme.md → AGENTS.md
- `mongoDB` --semantically_similar_to--> `MongoDB`  [INFERRED] [semantically similar]
  readme.md → AGENTS.md
- `selectMediaFormats()` --calls--> `httpError()`  [INFERRED]
  src\utils\yt-util.mjs → src\utils\clip-time-util.mjs
- `loadClipMediaPlan()` --calls--> `httpError()`  [INFERRED]
  src\utils\yt-util.mjs → src\utils\clip-time-util.mjs

## Hyperedges (group relationships)
- **Express API Runtime Structure** — AGENTS_src_directory, AGENTS_server_mjs, AGENTS_router_directory, AGENTS_controller_directory, AGENTS_middleware_directory, AGENTS_express_api [EXTRACTED 1.00]
- **Development Command Set** — AGENTS_npm_install, AGENTS_npm_start, AGENTS_prisma_generate, AGENTS_probe_eval, AGENTS_npm_test_placeholder [EXTRACTED 1.00]
- **Local Service Configuration** — AGENTS_mongodb, AGENTS_database_url, AGENTS_redis, AGENTS_om_client_mjs, AGENTS_redis_service_mjs [EXTRACTED 1.00]

## Communities

### Community 0 - "YouTube Media Pipeline"
Cohesion: 0.17
Nodes (16): httpError(), parseTimestamp(), buildFfmpegArgs(), createMediaRangeProxy(), decipherMediaUrl(), ffmpegTime(), genClipFileWithMediaPlan(), generateAdaptiveClipWithYtDlp() (+8 more)

### Community 1 - "Infrastructure Configuration"
Cohesion: 0.12
Nodes (20): cert Directory, Chat Analysis, DATABASE_URL, External Test Dependencies, MongoDB, om/client.mjs, output Directory, npx prisma generate (+12 more)

### Community 2 - "Redis Cache Middleware"
Cohesion: 0.13
Nodes (4): RedisMiddleware, RedisService, setWordHeatMap(), tokenizeJapanese()

### Community 3 - "Chat Analysis Engine"
Cohesion: 0.25
Nodes (1): ChatAnalyzer

### Community 4 - "YouTube Controller Flow"
Cohesion: 0.19
Nodes (5): YtController, cnvTimestampToMin(), fmtTimestamp(), normTimestamp(), listenYt()

### Community 5 - "Clip Batch Generation"
Cohesion: 0.23
Nodes (6): clipResponse(), batchStatusCode(), buildBatchClipJobs(), errorResponse(), validateBatchClipInput(), genClipFile()

### Community 6 - "Project Structure"
Cohesion: 0.18
Nodes (12): controller Directory, JavaScript ES Module Style, Express API, middleware Directory, Node.js ES Module Backend, npm install, npm start, npm test Placeholder (+4 more)

### Community 7 - "Routing and Tests"
Cohesion: 0.22
Nodes (1): YtRouter

### Community 8 - "Request Body Middleware"
Cohesion: 0.5
Nodes (1): CommonMiddleware

### Community 9 - "Chat Model"
Cohesion: 1.0
Nodes (1): Chat

## Knowledge Gaps
- **12 isolated node(s):** `Chat`, `src Runtime Source Directory`, `Chat Analysis`, `Redis OM Entities`, `output Directory` (+7 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Chat Analysis Engine`** (14 nodes): `ChatAnalyzer`, `.analyze()`, `.#buildResult()`, `.#calBaseline()`, `.#calSpikeScore()`, `.constructor()`, `.#getMatchedWords()`, `.getObj()`, `.#isClippable()`, `.load()`, `.#normalizeWords()`, `.#numberOrDefault()`, `.#rankAndApplyCooldown()`, `.#resolveOptions()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Routing and Tests`** (11 nodes): `YtRouter`, `.constructor()`, `.init()`, `app-const.mjs`, `yt-controller.mjs`, `yt-router.mjs`, `chat-analyzer.mjs`, `analyze()`, `bucket()`, `chat-analyzer.probe.mjs`, `ts()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Request Body Middleware`** (4 nodes): `CommonMiddleware`, `.constructor()`, `.hasRequestBody()`, `common-middleware.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Chat Model`** (2 nodes): `Chat`, `chat.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ChatAnalyzer` connect `Chat Analysis Engine` to `Routing and Tests`?**
  _High betweenness centrality (0.122) - this node is a cross-community bridge._
- **Why does `YtController` connect `YouTube Controller Flow` to `Clip Batch Generation`, `Routing and Tests`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `genClipFileWithMediaPlan()` (e.g. with `.genClipBatch()` and `httpError()`) actually correct?**
  _`genClipFileWithMediaPlan()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `httpError()` (e.g. with `selectMediaFormats()` and `loadClipMediaPlan()`) actually correct?**
  _`httpError()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `loadClipMediaPlan()` (e.g. with `.genClipBatch()` and `httpError()`) actually correct?**
  _`loadClipMediaPlan()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Chat`, `src Runtime Source Directory`, `Chat Analysis` to the rest of the system?**
  _12 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Infrastructure Configuration` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._