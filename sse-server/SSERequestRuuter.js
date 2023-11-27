const events = require("events");
function SSERequestRuuter(router, eventSourceUrl = "") {
    let clients = [];
    const eventEmitter = new events.EventEmitter();
    const resList = {};

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
    function _fetch(path, body = {}, options = {}) {
        return new Promise((resolve, reject) => {
            const { method = "GET" } = options;

            const payload = {
                uid: Date.now(),
                url: path,
                method: method || "GET",
                body: body || {},
            }

            resList[payload.uid] = { resolve, reject };
            sendRequest(payload);
        });
    }

    function sendRequest(_request) {
        clients.filter(client => client.main === true).forEach(client => client.response.write(`data: ${JSON.stringify(_request)}\n\n`));
    }

    router.post(`${eventSourceUrl}/respond`, (req, res) => {
        const { body } = req;
        const { uid, status, data } = body;

        if (uid && resList[uid]) {
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

    function on(...args) {
        eventEmitter.addListener(...args);
    }

    function off(...args) {
        eventEmitter.removeListener(...args);
    }

    return {
        on, off, fetch: _fetch,
        get active() {
            return hasActiveClient();
        }
    }
}

module.exports = SSERequestRuuter;