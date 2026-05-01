/// <reference path="./.sst/platform/config.d.ts" />
export default $config({
  app(input) {
    return {
      name: "back",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage),
      home: "aws",
      providers: {
        aws: {
          region: process.env.AWS_REGION ?? "us-east-1",
        },
        cloudflare: {
          version: "6.14.0",
          apiToken: process.env.CLOUDFLARE_API_TOKEN,
        },
      },
    };
  },
  async run() {
    const { default: path } = await import("path");
    const isProduction = $app.stage === "production";
    const logLevel = isProduction ? "info" : "debug";
    // ── DynamoDB single-table ─────────────────────────────────────────────────
    const table = new sst.aws.Dynamo("TrimtokTable", {
      fields: {
        pk: "string",
        sk: "string",
        gsi1pk: "string",
        gsi1sk: "string",
      },
      primaryIndex: { hashKey: "pk", rangeKey: "sk" },
      globalIndexes: {
        gsi1: { hashKey: "gsi1pk", rangeKey: "gsi1sk" },
      },
      ttl: "expiresAt",
    });
    // ── S3 artifacts bucket ───────────────────────────────────────────────────
    const bucket = new sst.aws.Bucket("ArtifactsBucket", {
      versioning: false,
      transform: {
        bucket: {
          lifecycleRules: [
            {
              id: "expire-originals",
              enabled: true,
              prefix: "originals/",
              expiration: { days: 2 },
              abortIncompleteMultipartUploadDays: 1,
            },
            {
              id: "expire-trims",
              enabled: true,
              prefix: "trims/",
              expiration: { days: 1 },
              abortIncompleteMultipartUploadDays: 1,
            },
            {
              id: "expire-gifs",
              enabled: true,
              prefix: "gifs/",
              expiration: { days: 1 },
              abortIncompleteMultipartUploadDays: 1,
            },
            {
              id: "expire-mp3s-originals",
              enabled: true,
              prefix: "mp3s/originals/",
              expiration: { days: 2 },
              abortIncompleteMultipartUploadDays: 1,
            },
            {
              id: "expire-mp3s-trims",
              enabled: true,
              prefix: "mp3s/trims/",
              expiration: { days: 1 },
              abortIncompleteMultipartUploadDays: 1,
            },
          ],
        },
      },
    });
    // ── SQS Queues with DLQs ──────────────────────────────────────────────────
    const downloadDlq = new sst.aws.Queue("DownloadDLQ");
    const downloadQueue = new sst.aws.Queue("DownloadQueue", {
      dlq: { queue: downloadDlq.arn, retry: 2 },
      visibilityTimeout: "240 seconds",
    });
    const trimDlq = new sst.aws.Queue("TrimDLQ");
    const trimQueue = new sst.aws.Queue("TrimQueue", {
      dlq: { queue: trimDlq.arn, retry: 2 },
      visibilityTimeout: "240 seconds",
    });
    const gifDlq = new sst.aws.Queue("GifDLQ");
    const gifQueue = new sst.aws.Queue("GifQueue", {
      dlq: { queue: gifDlq.arn, retry: 2 },
      visibilityTimeout: "240 seconds",
    });
    const mp3Dlq = new sst.aws.Queue("Mp3DLQ");
    const mp3Queue = new sst.aws.Queue("Mp3Queue", {
      dlq: { queue: mp3Dlq.arn, retry: 2 },
      visibilityTimeout: "240 seconds",
    });
    // ── Lambda layers ──────────────────────────────────────────────────────
    // Binaries must be placed in layers/ytdlp/bin/yt-dlp and layers/ffmpeg/bin/ffmpeg
    // before deploying. See layers/.gitignore for download instructions.
    const ytdlpLayerZip = new aws.s3.BucketObjectv2("YtdlpLayerZip", {
      bucket: bucket.name,
      key: "layers/ytdlp.zip",
      source: new $util.asset.FileArchive(
        path.join($cli.paths.root, "layers/ytdlp"),
      )
    });
    const ytdlpLayer = new aws.lambda.LayerVersion("YtdlpLayer", {
      layerName: "trimtok-ytdlp-arm64",
      s3Bucket: ytdlpLayerZip.bucket,
      s3Key: ytdlpLayerZip.key,
      compatibleArchitectures: ["arm64"],
      compatibleRuntimes: ["provided.al2023"],
    });
    // ffmpeg binary is ~150MB — direct upload limit is ~70MB, so upload via S3
    const ffmpegLayerZip = new aws.s3.BucketObjectv2("FfmpegLayerZip", {
      bucket: bucket.name,
      key: "layers/ffmpeg.zip",
      source: new $util.asset.FileArchive(
        path.join($cli.paths.root, "layers/ffmpeg"),
      ),
    });
    const ffmpegLayer = new aws.lambda.LayerVersion("FfmpegLayer", {
      layerName: "trimtok-ffmpeg-arm64",
      s3Bucket: ffmpegLayerZip.bucket,
      s3Key: ffmpegLayerZip.key,
      compatibleArchitectures: ["arm64"],
      compatibleRuntimes: ["provided.al2023"],
    });
    // ── Secrets ───────────────────────────────────────────────────────────────
    const cfSecret = isProduction ? new sst.Secret("CloudflareSecret") : undefined;

    // ── Common Lambda links ───────────────────────────────────────────────────
    const baseLinks = [table, bucket];
    // ── WebSocket API ─────────────────────────────────────────────────────────
    const wsApi = new sst.aws.ApiGatewayWebSocket("WsApi", {
      accessLog: { retention: "1 week" },
    });
    wsApi.route("$connect", {
      handler: "src/handlers/websocket/connect.handler",
      link: [...baseLinks],
      logging: { retention: "1 week" },
      environment: { LOG_LEVEL: logLevel },
    });
    wsApi.route("$disconnect", {
      handler: "src/handlers/websocket/disconnect.handler",
      link: [...baseLinks],
      logging: { retention: "1 week" },
      environment: { LOG_LEVEL: logLevel },
    });
    wsApi.route("subscribe", {
      handler: "src/handlers/websocket/subscribe.handler",
      link: [...baseLinks, wsApi],
      logging: { retention: "1 week" },
      environment: { LOG_LEVEL: logLevel },
    });
    // ── HTTP API ──────────────────────────────────────────────────────────────
    const api = new sst.aws.ApiGatewayV2("Api", {
      link: baseLinks,
      accessLog: { retention: "1 week" },
      cors: {
        allowOrigins: isProduction ? ["https://trimtok.pool-llerena.com"] : ["*"],
        allowHeaders: ["content-type", "authorization"],
        allowMethods: ["GET", "POST", "OPTIONS"],
        maxAge: "1 day",
      },
      domain: isProduction ? {
        name: "trimtok-backend.pool-llerena.com",
        dns: sst.cloudflare.dns({ proxy: true }),
      } : undefined,
      transform: {
        api: (args) => {
          args.disableExecuteApiEndpoint = isProduction;
        },
      },
    });

    // ── Cloudflare Lambda Authorizer ──────────────────────────────────────────
    const cfAuthorizer = isProduction ? api.addAuthorizer({
      name: "CloudflareAuthorizer",
      lambda: {
        function: {
          handler: "src/handlers/authorizer/authorizer.handler",
          link: cfSecret ? [cfSecret] : [],
          logging: { retention: "1 week" },
          environment: { LOG_LEVEL: logLevel },
        },
        response: "simple",
        identitySources: ["$request.header.Custom-secret"],
        ttl: "5 seconds",
      },
    }) : undefined;
    const apiHandlerLinks = [
      ...baseLinks,
      downloadQueue,
      trimQueue,
      gifQueue,
      mp3Queue,
      wsApi,
    ];
    const cfAuth = cfAuthorizer ? { auth: { lambda: cfAuthorizer.id } } : undefined;

    const handlerOpts = { link: apiHandlerLinks, logging: { retention: "1 week" as const }, environment: { LOG_LEVEL: logLevel } };

    api.route("POST /v1/jobs", { handler: "src/handlers/api/create-job.handler", ...handlerOpts }, cfAuth);
    api.route("GET /v1/jobs/{jobId}", { handler: "src/handlers/api/get-job.handler", ...handlerOpts }, cfAuth);
    api.route("POST /v1/jobs/{jobId}/trim", { handler: "src/handlers/api/request-trim.handler", ...handlerOpts }, cfAuth);
    api.route("POST /v1/jobs/{jobId}/gif", { handler: "src/handlers/api/request-gif.handler", ...handlerOpts }, cfAuth);
    api.route("POST /v1/jobs/{jobId}/mp3", { handler: "src/handlers/api/request-mp3.handler", ...handlerOpts }, cfAuth);
    api.route("GET /health", { handler: "src/index.handler", logging: { retention: "1 week" }, environment: { LOG_LEVEL: logLevel } });
    // ── SQS Worker subscribers ────────────────────────────────────────────────
    const workerLinks = [...baseLinks, wsApi];
    downloadQueue.subscribe(
      {
        handler: "src/handlers/workers/download-worker.handler",
        link: [...workerLinks, downloadQueue],
        timeout: "240 seconds",
        memory: "1024 MB",
        layers: [ytdlpLayer.arn, ffmpegLayer.arn],
        architecture: "arm64",
        logging: { retention: "1 week" },
        dev: false,
        environment: {
          FFMPEG_PATH: "/opt/bin/ffmpeg",
          LOG_LEVEL: logLevel,
        },
      },
      { batch: { partialResponses: true } },
    );
    trimQueue.subscribe(
      {
        handler: "src/handlers/workers/trim-worker.handler",
        link: [...workerLinks, trimQueue],
        timeout: "240 seconds",
        memory: "1024 MB",
        layers: [ffmpegLayer.arn],
        architecture: "arm64",
        logging: { retention: "1 week" },
        dev: false,
        environment: { LOG_LEVEL: logLevel },
      },
      { batch: { partialResponses: true } },
    );
    gifQueue.subscribe(
      {
        handler: "src/handlers/workers/gif-worker.handler",
        link: [...workerLinks, gifQueue],
        timeout: "240 seconds",
        memory: "1024 MB",
        layers: [ffmpegLayer.arn],
        architecture: "arm64",
        logging: { retention: "1 week" },
        dev: false,
        environment: { LOG_LEVEL: logLevel },
      },
      { batch: { partialResponses: true } },
    );
    mp3Queue.subscribe(
      {
        handler: "src/handlers/workers/mp3-worker.handler",
        link: [...workerLinks, mp3Queue],
        timeout: "240 seconds",
        memory: "1024 MB",
        layers: [ffmpegLayer.arn],
        architecture: "arm64",
        logging: { retention: "1 week" },
        dev: false,
        environment: { LOG_LEVEL: logLevel },
      },
      { batch: { partialResponses: true } },
    );
    // ── CloudWatch Alarms for DLQs ────────────────────────────────────────────
    const dlqAlarms = [
      { name: "DownloadDLQAlarm", queueName: downloadDlq.nodes.queue.name },
      { name: "TrimDLQAlarm", queueName: trimDlq.nodes.queue.name },
      { name: "GifDLQAlarm", queueName: gifDlq.nodes.queue.name },
      { name: "Mp3DLQAlarm", queueName: mp3Dlq.nodes.queue.name },
    ];
    for (const alarm of dlqAlarms) {
      new aws.cloudwatch.MetricAlarm(alarm.name, {
        name: alarm.name,
        namespace: "AWS/SQS",
        metricName: "ApproximateNumberOfMessagesVisible",
        dimensions: { QueueName: alarm.queueName },
        comparisonOperator: "GreaterThanThreshold",
        threshold: 0,
        evaluationPeriods: 1,
        period: 60,
        statistic: "Sum",
        alarmDescription: `DLQ ${alarm.name} has messages — investigate failed workers`,
      });
    }
    return {
      ApiUrl: api.url,
      WsApiUrl: wsApi.url,
    };
  },
});
