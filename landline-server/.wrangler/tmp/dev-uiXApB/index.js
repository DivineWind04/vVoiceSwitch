var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-TsI6Vx/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader.apply(null, argArray)
    ]);
  }
});

// src/room.ts
var SignalingRoom = class {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }
  clients = /* @__PURE__ */ new Map();
  activeCalls = /* @__PURE__ */ new Map();
  nextClientNum = 1;
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/ws") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected WebSocket", { status: 426 });
      }
      const pair = new WebSocketPair();
      const [client, server] = [pair[0], pair[1]];
      server.accept();
      this.handleNewConnection(server);
      server.addEventListener("message", (event) => {
        console.log("[Room] WS message received, data type:", typeof event.data);
        if (typeof event.data === "string") {
          const cl = this.findClientByWs(server);
          if (!cl)
            return;
          let pdu;
          try {
            pdu = JSON.parse(event.data);
          } catch {
            this.sendTo(server, { type: "ERROR", reason: "Invalid JSON" });
            return;
          }
          this.handlePdu(cl, pdu);
        }
      });
      server.addEventListener("close", () => this.handleDisconnect(server));
      server.addEventListener("error", () => this.handleDisconnect(server));
      return new Response(null, { status: 101, webSocket: client });
    }
    if (url.pathname === "/health") {
      return Response.json({
        ok: true,
        clients: this.clients.size,
        activeCalls: this.activeCalls.size
      });
    }
    return new Response("Not Found", { status: 404 });
  }
  // ─── Durable Object WebSocket Handlers ───────────────────────────────
  async webSocketMessage(ws, message) {
    if (typeof message !== "string")
      return;
    const client = this.findClientByWs(ws);
    if (!client)
      return;
    let pdu;
    try {
      pdu = JSON.parse(message);
    } catch {
      this.sendTo(ws, { type: "ERROR", reason: "Invalid JSON" });
      return;
    }
    this.handlePdu(client, pdu);
  }
  async webSocketClose(ws, code, reason, wasClean) {
    this.handleDisconnect(ws);
  }
  async webSocketError(ws, error) {
    this.handleDisconnect(ws);
  }
  // ─── Connection Management ───────────────────────────────────────────
  handleNewConnection(ws) {
    const clientId = `c_${this.nextClientNum++}_${Date.now().toString(36)}`;
    const client = {
      clientId,
      ws,
      facility: null,
      position: null,
      assumedPositions: [],
      registered: false
    };
    this.clients.set(clientId, client);
  }
  handleDisconnect(ws) {
    const client = this.findClientByWs(ws);
    if (!client)
      return;
    this.activeCalls.forEach((call, callId) => {
      if (call.initiatorClientId === client.clientId || call.targetClientId === client.clientId) {
        const otherClientId = call.initiatorClientId === client.clientId ? call.targetClientId : call.initiatorClientId;
        if (otherClientId) {
          const otherClient = this.clients.get(otherClientId);
          if (otherClient) {
            this.sendTo(otherClient.ws, {
              type: "CALL_END",
              callId,
              endedByClientId: client.clientId
            });
          }
        }
        this.activeCalls.delete(callId);
      }
    });
    this.clients.delete(client.clientId);
    if (client.registered) {
      this.broadcastRoster();
    }
    try {
      ws.close(1e3, "Client disconnected");
    } catch {
    }
  }
  // ─── PDU Router ──────────────────────────────────────────────────────
  handlePdu(client, pdu) {
    console.log("[Room] PDU from", client.clientId, ":", pdu.type, JSON.stringify(pdu));
    switch (pdu.type) {
      case "REGISTER":
        this.handleRegister(client, pdu.facility, pdu.position, pdu.assumedPositions);
        break;
      case "CALL_U_SETUP":
        if (!client.registered) {
          this.sendTo(client.ws, { type: "ERROR", reason: "Not registered" });
          return;
        }
        this.handleCallSetup(client, pdu.callId, pdu.targetFacility, pdu.targetPosition, pdu.lineType);
        break;
      case "CALL_ACCEPTED":
        this.handleCallAccepted(client, pdu.callId);
        break;
      case "CALL_END":
        this.handleCallEnd(client, pdu.callId);
        break;
      case "CALL_HOLD":
        this.handleCallHold(client, pdu.callId);
        break;
      case "CALL_RETRIEVE":
        this.handleCallRetrieve(client, pdu.callId);
        break;
      case "WEBRTC_OFFER":
        this.relayWebrtc(client, pdu.toClientId, {
          type: "WEBRTC_OFFER",
          callId: pdu.callId,
          fromClientId: client.clientId,
          sdp: pdu.sdp
        });
        break;
      case "WEBRTC_ANSWER":
        this.relayWebrtc(client, pdu.toClientId, {
          type: "WEBRTC_ANSWER",
          callId: pdu.callId,
          fromClientId: client.clientId,
          sdp: pdu.sdp
        });
        break;
      case "WEBRTC_ICE":
        this.relayWebrtc(client, pdu.toClientId, {
          type: "WEBRTC_ICE",
          callId: pdu.callId,
          fromClientId: client.clientId,
          candidate: pdu.candidate
        });
        break;
    }
  }
  // ─── REGISTER ────────────────────────────────────────────────────────
  handleRegister(client, facility, position, assumedPositions) {
    for (const [, other] of this.clients) {
      if (other.clientId !== client.clientId && other.registered && other.facility === facility && other.position === position) {
        this.sendTo(client.ws, {
          type: "REGISTER_FAILED",
          reason: `Position ${position} at ${facility} is already taken`
        });
        return;
      }
    }
    client.facility = facility;
    client.position = position;
    client.assumedPositions = assumedPositions;
    client.registered = true;
    this.sendTo(client.ws, {
      type: "REGISTERED",
      clientId: client.clientId
    });
    this.broadcastRoster();
  }
  // ─── CALL_U_SETUP ───────────────────────────────────────────────────
  handleCallSetup(initiator, callId, targetFacility, targetPosition, lineType) {
    const target = this.findClientByPosition(targetFacility, targetPosition);
    if (!target) {
      this.sendTo(initiator.ws, {
        type: "CALL_ERROR",
        callId,
        reason: "not_found",
        message: `No client at ${targetFacility}/${targetPosition}`
      });
      return;
    }
    const call = {
      callId,
      initiatorClientId: initiator.clientId,
      targetClientId: target.clientId,
      targetFacility,
      targetPosition,
      lineType,
      state: "ringing",
      createdAt: Date.now()
    };
    this.activeCalls.set(callId, call);
    this.sendTo(target.ws, {
      type: "INCOMING_CALL",
      callId,
      fromClientId: initiator.clientId,
      fromFacility: initiator.facility,
      fromPosition: initiator.position,
      lineType
    });
  }
  // ─── CALL_ACCEPTED ──────────────────────────────────────────────────
  handleCallAccepted(client, callId) {
    const call = this.activeCalls.get(callId);
    if (!call)
      return;
    if (call.targetClientId !== client.clientId)
      return;
    call.state = "accepted";
    const initiator = this.clients.get(call.initiatorClientId);
    if (initiator) {
      this.sendTo(initiator.ws, {
        type: "CALL_ACCEPTED",
        callId,
        acceptedByClientId: client.clientId
      });
    }
  }
  // ─── CALL_END ────────────────────────────────────────────────────────
  handleCallEnd(client, callId) {
    const call = this.activeCalls.get(callId);
    if (!call)
      return;
    const otherClientId = call.initiatorClientId === client.clientId ? call.targetClientId : call.initiatorClientId;
    if (otherClientId) {
      const otherClient = this.clients.get(otherClientId);
      if (otherClient) {
        this.sendTo(otherClient.ws, {
          type: "CALL_END",
          callId,
          endedByClientId: client.clientId
        });
      }
    }
    this.activeCalls.delete(callId);
  }
  // ─── CALL_HOLD ───────────────────────────────────────────────────────
  handleCallHold(client, callId) {
    const call = this.activeCalls.get(callId);
    if (!call)
      return;
    call.state = "hold";
    const otherClientId = call.initiatorClientId === client.clientId ? call.targetClientId : call.initiatorClientId;
    if (otherClientId) {
      const otherClient = this.clients.get(otherClientId);
      if (otherClient) {
        this.sendTo(otherClient.ws, {
          type: "CALL_HOLD",
          callId,
          heldByClientId: client.clientId
        });
      }
    }
  }
  // ─── CALL_RETRIEVE ──────────────────────────────────────────────────
  handleCallRetrieve(client, callId) {
    const call = this.activeCalls.get(callId);
    if (!call)
      return;
    call.state = "connected";
    const otherClientId = call.initiatorClientId === client.clientId ? call.targetClientId : call.initiatorClientId;
    if (otherClientId) {
      const otherClient = this.clients.get(otherClientId);
      if (otherClient) {
        this.sendTo(otherClient.ws, {
          type: "CALL_RETRIEVE",
          callId,
          retrievedByClientId: client.clientId
        });
      }
    }
  }
  // ─── WebRTC Relay ────────────────────────────────────────────────────
  relayWebrtc(from, toClientId, pdu) {
    const target = this.clients.get(toClientId);
    if (!target) {
      this.sendTo(from.ws, {
        type: "CALL_ERROR",
        callId: pdu.callId || "",
        reason: "not_found",
        message: `Client ${toClientId} not connected`
      });
      return;
    }
    this.sendTo(target.ws, pdu);
  }
  // ─── Helpers ─────────────────────────────────────────────────────────
  findClientByWs(ws) {
    for (const [, client] of this.clients) {
      if (client.ws === ws)
        return client;
    }
    return void 0;
  }
  findClientByPosition(facility, position) {
    const upperPos = position.toUpperCase();
    const upperFac = facility.toUpperCase();
    for (const [, client] of this.clients) {
      if (!client.registered)
        continue;
      if (client.facility?.toUpperCase() !== upperFac)
        continue;
      if (client.position?.toUpperCase() === upperPos || client.assumedPositions.some((p) => p.toUpperCase() === upperPos)) {
        return client;
      }
    }
    return void 0;
  }
  sendTo(ws, pdu) {
    try {
      console.log("[Room] Sending:", pdu.type, JSON.stringify(pdu));
      ws.send(JSON.stringify(pdu));
    } catch {
    }
  }
  broadcastRoster() {
    const roster = [];
    for (const [, client] of this.clients) {
      if (!client.registered)
        continue;
      roster.push({
        clientId: client.clientId,
        facility: client.facility,
        position: client.position,
        assumedPositions: client.assumedPositions
      });
    }
    const pdu = { type: "ROSTER_UPDATE", roster };
    for (const [, client] of this.clients) {
      if (client.registered) {
        this.sendTo(client.ws, pdu);
      }
    }
  }
};
__name(SignalingRoom, "SignalingRoom");

// src/index.ts
var src_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders()
      });
    }
    if (url.pathname === "/ws" || url.pathname === "/health") {
      const id = env.SIGNALING_ROOM.idFromName("global");
      const room = env.SIGNALING_ROOM.get(id);
      const response = await room.fetch(request);
      if (response.status !== 101) {
        const headers = new Headers(response.headers);
        for (const [k, v] of Object.entries(corsHeaders())) {
          headers.set(k, v);
        }
        return new Response(response.body, {
          status: response.status,
          headers
        });
      }
      return response;
    }
    if (url.pathname === "/") {
      return Response.json(
        { service: "landline-signaling", version: "0.1.0" },
        { headers: corsHeaders() }
      );
    }
    return new Response("Not Found", { status: 404, headers: corsHeaders() });
  }
};
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Upgrade, Connection"
  };
}
__name(corsHeaders, "corsHeaders");

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-TsI6Vx/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-TsI6Vx/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  SignalingRoom,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
