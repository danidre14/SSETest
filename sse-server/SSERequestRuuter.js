const events = require("events");
const crypto = require("crypto");
function SSERequestRuuter(router, eventSourceUrl = "") {
    let clients = [];
    const eventEmitter = new events.EventEmitter();
    const resList = {};
    const queuedFetches = [];
    const _defaultTTL = 30;

    function hasActiveClient() {
        return !!clients.find(client => client.main);
    }

    function addClient(newClient) {
        const firstClient = clients.length === 0;

        clients.push(newClient);

        if (firstClient)
            eventEmitter.emit("connect");
    }

    function refreshClients() {
        if (!hasActiveClient()) {
            clients.length = 0;

            for (const uid of Object.keys(resList)) {
                resList[uid].reject("Disconnected");
                delete resList[uid];
            }

            eventEmitter.emit("disconnect");
        }
    }

    router.get(`${eventSourceUrl}/connect`, (req, res, next) => {
        const headers = {
            "Content-Type": "text/event-stream",
            "Connection": "keep-alive",
            "Cache-Control": "no-cache",
        };
        res.writeHead(200, headers);

        const data = `data: []\n\n`;

        res.write(data);

        const clientId = Date.now();
        console.log(`${clientId} Connection opened`);

        const newClient = { id: clientId, response: res, main: true };
        clients = clients.map(client => {
            client.main = false;
            return client;
        });
        addClient(newClient);

        req.on("close", () => {
            console.log(`${clientId} Connection closed`);
            clients = clients.map(client => {
                if (client.id === clientId)
                    client.main = false;
                return client;
            });
            refreshClients();
        });
    });

    function _fetch(path, body = {}, options = {}, _bundle = {}) {
        return new Promise((res, rej) => {
            const uuid = uuidv4();
            if (!hasActiveClient()) {
                fetchWhenReady({ alive: true, uuid, path, body, options, resolve: res, reject: rej });
                return;
            }
            clearTimeout(_bundle?.tInt);
            _bundle.alive = false;
            const { method = "GET", ttl = _defaultTTL } = options;

            const data = {
                uid: uuid,
                url: path,
                method: method || "GET",
                body: body || {},
            }

            const payload = {
                alive: true,
            };
            const tInt = setTimeout(() => {
                if (!payload.alive) return;
                payload.alive = false;
                rej("Timeout");
            }, 1000 * (ttl || _defaultTTL));
            payload.resolve = function (...val) {
                payload.alive = false;
                clearTimeout(tInt);
                res(...val);
            }
            payload.reject = function (...val) {
                payload.alive = false;
                clearTimeout(tInt);
                rej(...val);
            }

            resList[data.uid] = payload;
            sendRequest(data);
        });
    }

    function fetchWhenReady(bundle) {
        const uuid = bundle.uuid;
        const { ttl = _defaultTTL } = bundle.options;
        bundle.tInt = setTimeout(() => {
            if (!bundle.alive) return;
            bundle.alive = false;
            const index = queuedFetches.findIndex(elem => elem.uuid === uuid);
            if (index != -1)
                queuedFetches.splice(index, 1);
            bundle.reject("Timeout");
        }, 1000 * (ttl || _defaultTTL));
        queuedFetches.push(bundle);
    }

    function sendRequest(_request) {
        clients.filter(client => client.main === true).forEach(client => client.response.write(`data: ${JSON.stringify(_request)}\n\n`));
    }

    router.post(`${eventSourceUrl}/respond`, (req, res) => {
        const { body } = req;
        const { uid, status, data } = body;

        if (uid && resList[uid]) {
            if (resList[uid].alive)
                if (status >= 400) {
                    resList[uid].reject(data);
                } else {
                    resList[uid].resolve(data);
                }
            delete resList[uid];
        } else {
            console.log(`unknown post: ${JSON.stringify(body)}`)
        }

        res.status(200).send("OK");
    });

    eventEmitter.on("connect", async () => {
        while (queuedFetches.length > 0) {
            const bundle = queuedFetches.shift();
            try {
                const response = await _fetch(bundle.path, bundle.body, bundle.options, bundle);
                bundle.resolve(response);
            } catch (error) {
                bundle.reject(error);
            }
        }
    });

    function on(...args) {
        eventEmitter.addListener(...args);
    }

    function off(...args) {
        eventEmitter.removeListener(...args);
    }

    // From: https://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid
    function uuidv4() {
        return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        );
    }

    return {
        on, off, fetch: async (path, body, options) => {
            return await _fetch(path, body, options);
        },
        get active() {
            return hasActiveClient();
        }
    }
}

module.exports = SSERequestRuuter;