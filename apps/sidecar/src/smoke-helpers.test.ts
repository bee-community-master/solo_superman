import { describe, expect, it } from "vitest";
import {
  dataRecord,
  firstRecord,
  getJson,
  objectAt,
  postJson,
  recordArray
} from "./smoke-helpers";

describe("smoke helpers", () => {
  it("accepts only explicit ok record envelopes", () => {
    expect(dataRecord({ ok: true, data: { status: "ready" } }, "fixture")).toEqual({ status: "ready" });
    expect(() => dataRecord({ ok: "true", data: { status: "ready" } }, "fixture")).toThrow(
      "fixture did not return an ok data envelope."
    );
    expect(() => dataRecord({ ok: true, data: [] }, "fixture")).toThrow(
      "fixture did not return an ok data envelope."
    );
  });

  it("keeps object assertions scoped to record objects", () => {
    expect(objectAt({ value: 1 }, "payload")).toEqual({ value: 1 });
    expect(() => objectAt([], "payload")).toThrow("payload must be a record object");
    expect(() => recordArray([{}], "records")).not.toThrow();
    expect(() => recordArray([[]], "records")).toThrow("records must be an array of record objects.");
    expect(firstRecord([{ id: "first" }], "records")).toEqual({ id: "first" });
  });

  it("uses one request helper path for smoke POST and GET envelopes", async () => {
    const requests: string[] = [];
    const app = {
      request(path: string, init?: RequestInit) {
        requests.push(`${init?.method ?? "GET"} ${path}`);

        return new Response(JSON.stringify({
          ok: true,
          data: { path, method: init?.method ?? "GET" }
        }));
      }
    };

    await expect(postJson(app, "/post", "token", { action: "run" })).resolves.toEqual({
      path: "/post",
      method: "POST"
    });
    await expect(getJson(app, "/get", "token")).resolves.toEqual({
      path: "/get",
      method: "GET"
    });
    expect(requests).toEqual(["POST /post", "GET /get"]);
  });
});
