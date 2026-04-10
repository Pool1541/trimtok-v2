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
          accessKey: process.env.AWS_ACCESS_KEY_ID,
          secretKey: process.env.AWS_SECRET_ACCESS_KEY,
          region: process.env.AWS_REGION,
        }
      }
    };
  },
  async run() {
    const api = new sst.aws.ApiGatewayV2("Api");
    api.route("GET /health", "src/index.handler");

    return {
      ApiUrl: api.url,
    };
  },
});
