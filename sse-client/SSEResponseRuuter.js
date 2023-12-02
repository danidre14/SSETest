const EventSource = require("eventsource");
// const eveSf = require("event-source-polyfill");

async function processMiddlewares(req, res, middlewares = []) {
    for (const middleware of middlewares) {
        let goNext = false;
        const next = () => goNext = true;
        await middleware(req, res, next);
        if (!goNext) {
            return;
        }
    }
};

function parseUrlParams(url) {
    let str = "";

    for (var i = 0; i < url.length; i++) {
        const c = url.charAt(i);
        if (c === ":") {
            // eat all characters
            let param = "";
            for (var j = i + 1; j < url.length; j++) {
                if (/\w/.test(url.charAt(j))) {
                    param += url.charAt(j);
                } else {
                    break;
                }
            }
            str += `(?<${param}>\\w+)`;
            i = j - 1;
        } else {
            str += c;
        }
    }
    return str + "\\/?(\\?.*$|$)";
}

function parseUrlQuery(url) {
    const results = url.match(/\?(?<query>.*)/);
    if (!results) {
        return {};
    }
    const { groups: { query } } = results;

    const pairs = query.match(/(?<param>\w+)=(?<value>\w+)/g);
    const params = pairs.reduce((acc, curr) => {
        const [key, value] = curr.split(("="));
        acc[key] = value;
        return acc;
    }, {});
    return params;
}

async function respondToRequest(uid, statusCode, data, eventSourceUrl) {
    try {
        const body = { uid, status: statusCode, data };
        await fetch(`${eventSourceUrl}/respond`, {
            method: "post",
            body: JSON.stringify(body),
            rejectUnauthorized: false,
            headers: { "Content-Type": "application/json" },
            requestCert: process.env.NODE_ENV === "production" || false,
            agent: false,
        });
    } catch (error) {
        console.error(`Failed to respond to request: ${error}`);
    }
}

function createResponse(uid, eventSourceUrl) {
    let alreadySent = false;
    let data = "";
    let _statusCode = 200;
    const end = (_data) => {
        if (alreadySent) {
            console.warn("Already responded to request. This end operation will be ignored.");
            return;
        }
        alreadySent = true;
        data = _data;
        respondToRequest(uid, _statusCode, data, eventSourceUrl);
    };
    const close = () => {
        if (!alreadySent) {
            console.warn("Finished processing but no response sent was detected. Will respond with a time out.");
            _statusCode = 408;
            data = "Timed out";
            respondToRequest(uid, _statusCode, data, eventSourceUrl);
        }
        alreadySent = true;
    }
    return {
        send: end, json: end, end, close,
        set statusCode(code) {
            _statusCode = code;
        },
        status(code) {
            _statusCode = code;
            return this;
        }
    };
}

function SSEResponseRuuter(eventSourceUrl = "") {
    let routeTable = {};
    const processReq = async (req) => {
        const res = createResponse(req.uid, eventSourceUrl);
        const routes = Object.keys(routeTable);
        let match = false;
        const url = req.url;

        for (const route of routes) {
            const parsedRoute = parseUrlParams(route);
            const method = req.method.toLowerCase();
            if (
                new RegExp(parsedRoute).test(url) &&
                routeTable[route][method]
            ) {
                const m = url.match(new RegExp(parsedRoute));

                req.params = m.groups;
                req.query = parseUrlQuery(url);
                req.body = req.body;

                const middlewares = routeTable[route][method];
                await processMiddlewares(req, res, middlewares);

                match = true;
                break;
            }
        }
        if (!match) {
            res.statusCode = 404;
            res.end("Not found");
        }
        res.close();
    };
    function registerPath(path, method, ...middlewares) {
        path = path.replace(/\/*$/g, "");
        if (!routeTable[path]) {
            routeTable[path] = {};
        }
        if (!routeTable[path][method]) {
            routeTable[path][method] = [];
        }
        routeTable[path][method].push(...middlewares);
    }

    const vars = {
        eventSource: null
    }
    function start() {
        const eventSource = new EventSource(`${eventSourceUrl}/connect`);
        eventSource.onopen = function (event) {
            console.log(`Event source ${event.type} and connected.`);
        };
        eventSource.onmessage = function (event) {
            const parsedData = JSON.parse(event.data);
            if (!parsedData.url || !parsedData.uid)
                return;

            const req = {
                uid: parsedData.uid,
                url: parsedData.url,
                method: parsedData.method || "GET",
                body: parsedData.body || {},
            }

            processReq(req);
        };
        eventSource.onerror = function (event) {
            console.error(`Event source ${event.type}: ${event.message}`);
            eventSource.close();
        };
        vars.eventSource = eventSource;
    }
    function stop() {
        vars.eventSource?.close();
    }

    return {
        start, stop,
        get(path, ...cbs) {
            registerPath(path, "get", ...cbs);
        },
        post(path, ...cbs) {
            registerPath(path, "post", ...cbs);
        },
        put(path, ...cbs) {
            registerPath(path, "put", ...cbs);
        },
        delete(path, ...cbs) {
            registerPath(path, "delete", ...cbs);
        }
    }
}

// process.on('uncaughtException', function (err) {
//     if (err.cause && typeof err.cause == "object") {
//         const cause = err.cause;
//         if (cause.errno == -4077 && cause.code == "ECONNRESET")
//             return;
//     }
//     throw new Error("Uncaught Exception", { cause: err });
// });

module.exports = SSEResponseRuuter;