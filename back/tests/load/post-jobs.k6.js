/**
 * k6 load test for SC-003: POST /jobs endpoint
 *
 * Scenario: Steady-state load test
 * - Target: 500 req/s sustained for 2 minutes
 * - SLO: p95 < 800ms, error rate < 1%
 *
 * Usage:
 *   k6 run --env API_BASE_URL=https://your-api.execute-api.us-east-1.amazonaws.com \
 *          tests/load/post-jobs.k6.js
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const errorRate = new Rate("error_rate");
const responseTime = new Trend("response_time_ms", true);

export const options = {
  scenarios: {
    steady_load: {
      executor: "constant-arrival-rate",
      rate: 500,
      timeUnit: "1s",
      duration: "2m",
      preAllocatedVUs: 100,
      maxVUs: 500,
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<800"],
    error_rate: ["rate<0.01"],
  },
};

const API_BASE_URL = __ENV.API_BASE_URL || "https://localhost:3000";

// Sample TikTok URLs for load testing (use placeholder URLs)
const SAMPLE_URLS = [
  "https://tiktok.com/@user1/video/1111111111111111111",
  "https://tiktok.com/@user2/video/2222222222222222222",
  "https://tiktok.com/@user3/video/3333333333333333333",
  "https://vm.tiktok.com/4444444444",
  "https://tiktok.com/@user5/video/5555555555555555555",
];

export default function () {
  const url = SAMPLE_URLS[Math.floor(Math.random() * SAMPLE_URLS.length)];

  const payload = JSON.stringify({ url, format: "mp4" });
  const params = {
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
    },
  };

  const res = http.post(`${API_BASE_URL}/jobs`, payload, params);

  const success = check(res, {
    "status is 200 or 201": (r) => r.status === 200 || r.status === 201,
    "response has jobId or downloadUrl": (r) => {
      try {
        const body = JSON.parse(r.body as string);
        return body.jobId !== undefined || body.downloadUrl !== undefined;
      } catch {
        return false;
      }
    },
    "response time < 800ms": (r) => r.timings.duration < 800,
  });

  errorRate.add(!success);
  responseTime.add(res.timings.duration);

  sleep(0.001); // 1ms think time
}
